/**
 * HANDOFF: QuickBooks Online integration (single global connection).
 * - Tokens are stored encrypted (tokenCrypto.ts); never log them. DB status values: connected | needs_reconnect.
 * - `withAccountingLock` holds a row lock while making remote calls; keep remote work bounded.
 * - Invoice lines use the job's booked amount with a tax code: GST/PST handling has NOT been verified with a
 *   bookkeeper. Do not change tax logic without the owner's input.
 */
import { createHash, randomBytes } from "crypto";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  accountingLinks,
  customers,
  integrationConnections,
  jobs,
  oauthStates,
  payments,
  syncEvents,
} from "../drizzle/schema";
import { SERVICES } from "../shared/site";
import { winnipegDay } from "./analytics";
import { getDb } from "./db";
import { PublicError } from "./http";
import { decryptToken, encryptToken } from "./tokenCrypto";
import { accountingRequestId } from "./accountingIdentity";
import { ENV } from "./_core/env";

const PROVIDER = "quickbooks";
const AUTHORIZE_URL = "https://appcenter.intuit.com/connect/oauth2";
const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const REVOKE_URL = "https://developer.api.intuit.com/v2/oauth2/tokens/revoke";
const API_BASE = {
  sandbox: "https://sandbox-quickbooks.api.intuit.com",
  production: "https://quickbooks.api.intuit.com",
} as const;
const SCOPE = "com.intuit.quickbooks.accounting";
const MINOR_VERSION = "75";
export const QBO_CALLBACK_PATH = "/api/integrations/quickbooks/callback";

type Environment = keyof typeof API_BASE;

async function database() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db;
}

function credentials() {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID ?? "";
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET ?? "";
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function quickbooksConfigured(): boolean {
  return credentials() !== null;
}

function basicAuth() {
  const creds = credentials();
  if (!creds)
    throw new PublicError(
      "Add your QuickBooks app keys before connecting.",
      409
    );
  return `Basic ${Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64")}`;
}

const hashState = (state: string) =>
  createHash("sha256").update(state).digest("hex");

export async function logSync(
  action: string,
  localId: string | null,
  outcome: "success" | "error",
  message: string
) {
  try {
    const db = await database();
    await db.insert(syncEvents).values({
      provider: PROVIDER,
      action: action.slice(0, 40),
      localId,
      outcome,
      message: message.slice(0, 500),
    });
  } catch (error) {
    console.warn(
      "[QuickBooks] Could not record sync activity:",
      error instanceof Error ? error.message : "unknown error"
    );
  }
}

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  x_refresh_token_expires_in?: number;
};

class TokenError extends Error {
  constructor(readonly code: string) {
    super(`QuickBooks token request failed: ${code}`);
  }
}

async function tokenRequest(
  params: Record<string, string>
): Promise<TokenResponse> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuth(),
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params).toString(),
    signal: AbortSignal.timeout(20000),
  });
  const body = (await response
    .json()
    .catch(() => ({}))) as Partial<TokenResponse> & {
    error?: string;
  };
  if (!response.ok || !body.access_token || !body.refresh_token)
    throw new TokenError(body.error ?? `http_${response.status}`);
  return body as TokenResponse;
}

function expiry(seconds: number | undefined): Date | null {
  return seconds && Number.isFinite(seconds)
    ? new Date(Date.now() + seconds * 1000)
    : null;
}

export async function startConnect(input: {
  environment: Environment;
  origin: string;
  adminOpenId: string;
}) {
  const creds = credentials();
  if (!creds)
    throw new PublicError(
      "Add your QuickBooks app keys before connecting.",
      409
    );
  const db = await database();
  const state = randomBytes(32).toString("base64url");
  const redirectUri = `${input.origin}${QBO_CALLBACK_PATH}`;
  await db.insert(oauthStates).values({
    stateHash: hashState(state),
    provider: PROVIDER,
    environment: input.environment,
    redirectUri,
    createdBy: input.adminOpenId,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", creds.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return { authorizeUrl: url.toString(), redirectUri };
}

/** Completes the OAuth callback; returns a short outcome code for the UI. */
export async function completeConnect(query: {
  state?: string;
  code?: string;
  realmId?: string;
  error?: string;
}): Promise<"connected" | "denied" | "expired" | "failed"> {
  if (!query.state || query.state.length > 200) return "expired";
  const db = await database();
  const stateHash = hashState(query.state);
  const [record] = await db
    .select()
    .from(oauthStates)
    .where(
      and(
        eq(oauthStates.stateHash, stateHash),
        eq(oauthStates.provider, PROVIDER),
        isNull(oauthStates.usedAt)
      )
    )
    .limit(1);
  if (!record || record.expiresAt.getTime() < Date.now()) return "expired";
  const claimed = await db
    .update(oauthStates)
    .set({ usedAt: new Date() })
    .where(
      and(eq(oauthStates.stateHash, stateHash), isNull(oauthStates.usedAt))
    );
  if (Number(claimed[0]?.affectedRows ?? 0) !== 1) return "expired";
  if (query.error) return "denied";
  if (!query.code || !query.realmId || !/^\d{1,32}$/.test(query.realmId))
    return "failed";
  try {
    const tokens = await tokenRequest({
      grant_type: "authorization_code",
      code: query.code,
      redirect_uri: record.redirectUri,
    });
    let companyName: string | null = null;
    try {
      const info = await rawApi(
        record.environment,
        query.realmId,
        tokens.access_token,
        "GET",
        `/companyinfo/${query.realmId}`
      );
      companyName =
        (info as { CompanyInfo?: { CompanyName?: string } }).CompanyInfo
          ?.CompanyName ?? null;
    } catch {
      companyName = null;
    }
    const now = new Date();
    const values = {
      provider: PROVIDER,
      environment: record.environment,
      realmId: query.realmId,
      companyName: companyName?.slice(0, 200) ?? null,
      accessTokenEnc: encryptToken(tokens.access_token),
      refreshTokenEnc: encryptToken(tokens.refresh_token),
      accessTokenExpiresAt:
        expiry(tokens.expires_in) ?? new Date(Date.now() + 3600e3),
      refreshTokenExpiresAt: expiry(tokens.x_refresh_token_expires_in),
      status: "connected" as const,
      connectedAt: now,
    };
    const [existing] = await db
      .select({ realmId: integrationConnections.realmId })
      .from(integrationConnections)
      .where(eq(integrationConnections.provider, PROVIDER))
      .limit(1);
    if (existing) {
      const sameCompany = existing.realmId === query.realmId;
      await db
        .update(integrationConnections)
        .set({
          ...values,
          ...(sameCompany
            ? {}
            : {
                defaultItemId: null,
                defaultItemName: null,
                defaultTaxCodeId: null,
                defaultTaxCodeName: null,
                autoSyncPayments: false,
              }),
        })
        .where(eq(integrationConnections.provider, PROVIDER));
    } else {
      await db.insert(integrationConnections).values(values);
    }
    await logSync(
      "connect",
      null,
      "success",
      `Connected to ${companyName ?? "QuickBooks company"} (${record.environment}).`
    );
    return "connected";
  } catch (error) {
    await logSync(
      "connect",
      null,
      "error",
      error instanceof TokenError
        ? `Authorization failed (${error.code}). Check the app keys, environment and redirect URI.`
        : "Authorization could not be completed."
    );
    return "failed";
  }
}

type Context = {
  token: string;
  realmId: string;
  environment: Environment;
};

async function accessContext(forceRefresh = false): Promise<Context> {
  const db = await database();
  const outcome = await db.transaction(async tx => {
    const [conn] = await tx
      .select()
      .from(integrationConnections)
      .where(eq(integrationConnections.provider, PROVIDER))
      .limit(1)
      .for("update");
    if (!conn) return { kind: "missing" as const };
    if (conn.status === "needs_reconnect")
      return { kind: "reconnect" as const };
    const base = { realmId: conn.realmId, environment: conn.environment };
    if (
      !forceRefresh &&
      conn.accessTokenExpiresAt.getTime() - Date.now() > 2 * 60 * 1000
    )
      return {
        kind: "ok" as const,
        ...base,
        token: decryptToken(conn.accessTokenEnc),
      };
    try {
      const tokens = await tokenRequest({
        grant_type: "refresh_token",
        refresh_token: decryptToken(conn.refreshTokenEnc),
      });
      await tx
        .update(integrationConnections)
        .set({
          accessTokenEnc: encryptToken(tokens.access_token),
          refreshTokenEnc: encryptToken(tokens.refresh_token),
          accessTokenExpiresAt:
            expiry(tokens.expires_in) ?? new Date(Date.now() + 3600e3),
          refreshTokenExpiresAt:
            expiry(tokens.x_refresh_token_expires_in) ??
            conn.refreshTokenExpiresAt,
        })
        .where(eq(integrationConnections.provider, PROVIDER));
      return { kind: "ok" as const, ...base, token: tokens.access_token };
    } catch (error) {
      if (error instanceof TokenError && error.code === "invalid_grant") {
        await tx
          .update(integrationConnections)
          .set({ status: "needs_reconnect" })
          .where(eq(integrationConnections.provider, PROVIDER));
        return { kind: "reconnect" as const };
      }
      throw error;
    }
  });
  if (outcome.kind === "missing")
    throw new PublicError("QuickBooks is not connected.", 409);
  if (outcome.kind === "reconnect") {
    await logSync(
      "refresh",
      null,
      "error",
      "QuickBooks authorization expired. Reconnect to continue syncing."
    );
    throw new PublicError("QuickBooks needs to be reconnected.", 409);
  }
  return outcome;
}

export class QboError extends PublicError {
  constructor(
    message: string,
    readonly code: string,
    status = 502
  ) {
    super(message, status);
  }
}

async function rawApi(
  environment: Environment,
  realmId: string,
  token: string,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  query: Record<string, string> = {}
): Promise<unknown> {
  const url = new URL(`${API_BASE[environment]}/v3/company/${realmId}${path}`);
  for (const [key, value] of Object.entries(query))
    url.searchParams.set(key, value);
  url.searchParams.set("minorversion", MINOR_VERSION);
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(25000),
  });
  const data = (await response.json().catch(() => ({}))) as {
    Fault?: {
      Error?: Array<{ Message?: string; Detail?: string; code?: string }>;
    };
  };
  if (response.status === 401) throw new QboError("unauthorized", "401", 401);
  if (!response.ok || data.Fault) {
    const first = data.Fault?.Error?.[0];
    throw new QboError(
      `QuickBooks: ${first?.Detail || first?.Message || `request failed (${response.status})`}`.slice(
        0,
        400
      ),
      first?.code ?? String(response.status)
    );
  }
  return data;
}

async function api(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  query?: Record<string, string>
) {
  let ctx = await accessContext();
  try {
    return {
      ctx,
      data: await rawApi(
        ctx.environment,
        ctx.realmId,
        ctx.token,
        method,
        path,
        body,
        query
      ),
    };
  } catch (error) {
    if (!(error instanceof QboError) || error.code !== "401") throw error;
    ctx = await accessContext(true);
    return {
      ctx,
      data: await rawApi(
        ctx.environment,
        ctx.realmId,
        ctx.token,
        method,
        path,
        body,
        query
      ),
    };
  }
}

async function qboQuery<T>(statement: string, entity: string): Promise<T[]> {
  const { data } = await api("GET", "/query", undefined, { query: statement });
  const response = (data as { QueryResponse?: Record<string, T[]> })
    .QueryResponse;
  return response?.[entity] ?? [];
}

async function getConnection() {
  const db = await database();
  const [conn] = await db
    .select()
    .from(integrationConnections)
    .where(eq(integrationConnections.provider, PROVIDER))
    .limit(1);
  return conn ?? null;
}

export async function getStatus() {
  const db = await database();
  const conn = await getConnection();
  const events = await db
    .select()
    .from(syncEvents)
    .where(eq(syncEvents.provider, PROVIDER))
    .orderBy(desc(syncEvents.createdAt))
    .limit(25);
  return {
    configured: quickbooksConfigured(),
    callbackPath: QBO_CALLBACK_PATH,
    connection: conn
      ? {
          environment: conn.environment,
          realmId: conn.realmId,
          companyName: conn.companyName,
          status: conn.status,
          connectedAt: conn.connectedAt.toISOString(),
          refreshTokenExpiresAt:
            conn.refreshTokenExpiresAt?.toISOString() ?? null,
          defaultItemId: conn.defaultItemId,
          defaultItemName: conn.defaultItemName,
          defaultTaxCodeId: conn.defaultTaxCodeId,
          defaultTaxCodeName: conn.defaultTaxCodeName,
          autoSyncPayments: conn.autoSyncPayments,
        }
      : null,
    events: events.map(event => ({
      ...event,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

export async function disconnect() {
  const conn = await getConnection();
  if (!conn) return;
  try {
    await fetch(REVOKE_URL, {
      method: "POST",
      headers: {
        Authorization: basicAuth(),
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token: decryptToken(conn.refreshTokenEnc) }),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    // Revocation is best effort; local tokens are removed regardless.
  }
  const db = await database();
  await db
    .delete(integrationConnections)
    .where(eq(integrationConnections.provider, PROVIDER));
  await logSync(
    "disconnect",
    null,
    "success",
    "Disconnected QuickBooks and deleted stored tokens."
  );
}

export async function listOptions() {
  const [items, taxCodes] = await Promise.all([
    qboQuery<{ Id: string; Name: string; Type?: string }>(
      "select Id, Name, Type from Item where Active = true maxresults 200",
      "Item"
    ),
    qboQuery<{ Id: string; Name: string }>(
      "select Id, Name from TaxCode where Active = true maxresults 100",
      "TaxCode"
    ).catch(() => []),
  ]);
  return {
    items: items
      .filter(item => item.Type !== "Category")
      .map(item => ({ id: item.Id, name: item.Name, type: item.Type ?? null })),
    taxCodes: taxCodes.map(code => ({ id: code.Id, name: code.Name })),
  };
}

export async function updateSettings(settings: {
  defaultItemId: string | null;
  defaultItemName: string | null;
  defaultTaxCodeId: string | null;
  defaultTaxCodeName: string | null;
  autoSyncPayments: boolean;
}) {
  const db = await database();
  const result = await db
    .update(integrationConnections)
    .set(settings)
    .where(eq(integrationConnections.provider, PROVIDER));
  return Number(result[0]?.affectedRows ?? 0) > 0;
}

async function findLink(
  realmId: string,
  entityType: "customer" | "invoice" | "payment",
  localId: string
) {
  const db = await database();
  const [link] = await db
    .select()
    .from(accountingLinks)
    .where(
      and(
        eq(accountingLinks.realmId, realmId),
        eq(accountingLinks.entityType, entityType),
        eq(accountingLinks.localId, localId)
      )
    )
    .limit(1);
  return link ?? null;
}

async function saveLink(
  realmId: string,
  entityType: "customer" | "invoice" | "payment",
  localId: string,
  remoteId: string,
  remoteNumber: string | null
) {
  const db = await database();
  await db
    .insert(accountingLinks)
    .values({ realmId, entityType, localId, remoteId, remoteNumber })
    .onDuplicateKeyUpdate({
      set: { localId: sql`${accountingLinks.localId}` },
    });
  const saved = await findLink(realmId, entityType, localId);
  if (!saved || saved.remoteId !== remoteId)
    throw new PublicError(
      "Conflicting accounting link. Review the company records before retrying.",
      409
    );
}

// A local entity row is a durable cross-instance mutex. Remote writes use a
// stable Intuit requestid too, covering remote success followed by local failure.
async function withAccountingLock<T>(
  table: typeof customers | typeof jobs | typeof payments,
  id: string,
  work: () => Promise<T>
): Promise<T> {
  const db = await database();
  return db.transaction(async tx => {
    await tx.execute(
      sql`SELECT ${table.id} FROM ${table} WHERE ${table.id} = ${id} FOR UPDATE`
    );
    return work();
  });
}

function createRequestId(
  realmId: string,
  entity: string,
  localId: string,
  variant = "primary"
) {
  return accountingRequestId(ENV.appId, realmId, entity, localId, variant);
}

export async function linksFor(localIds: string[]) {
  const conn = await getConnection();
  if (!conn || localIds.length === 0) return [];
  const db = await database();
  return db
    .select({
      entityType: accountingLinks.entityType,
      localId: accountingLinks.localId,
      remoteId: accountingLinks.remoteId,
      remoteNumber: accountingLinks.remoteNumber,
    })
    .from(accountingLinks)
    .where(
      and(
        eq(accountingLinks.realmId, conn.realmId),
        inArray(accountingLinks.localId, localIds.slice(0, 300))
      )
    );
}

const displayName = (value: string) =>
  value
    .replace(/[:\t\r\n]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100) || "Customer";
const qboString = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

async function run<T>(
  action: string,
  localId: string,
  task: () => Promise<{ result: T; message: string }>
) {
  try {
    const { result, message } = await task();
    await logSync(action, localId, "success", message);
    return result;
  } catch (error) {
    await logSync(
      action,
      localId,
      "error",
      error instanceof PublicError
        ? error.message
        : "Unexpected QuickBooks error."
    );
    throw error;
  }
}

export function syncCustomer(customerId: string) {
  return withAccountingLock(customers, customerId, () =>
    syncCustomerUnlocked(customerId)
  );
}

async function syncCustomerUnlocked(customerId: string) {
  const ctx = await accessContext();
  const existing = await findLink(ctx.realmId, "customer", customerId);
  if (existing) return existing;
  return run("sync_customer", customerId, async () => {
    const db = await database();
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1);
    if (!customer) throw new PublicError("Customer not found.", 404);
    let remote: { Id: string; DisplayName?: string } | undefined;
    try {
      [remote] = await qboQuery<{ Id: string; DisplayName?: string }>(
        `select Id, DisplayName from Customer where PrimaryEmailAddr = '${qboString(customer.email)}'`,
        "Customer"
      );
    } catch (error) {
      // Unsupported email filtering may fall back to creating a named record;
      // transport/authorization errors must not turn into blind creates.
      if (!(error instanceof QboError) || error.code !== "4001") throw error;
      remote = undefined;
    }
    let message =
      `Linked to existing QuickBooks customer ${remote?.DisplayName ?? ""}`.trim();
    if (!remote) {
      const body = (name: string) => ({
        DisplayName: name,
        PrimaryEmailAddr: { Address: customer.email },
        ...(customer.phone
          ? { PrimaryPhone: { FreeFormNumber: customer.phone.slice(0, 30) } }
          : {}),
        Notes: `Seasonal Solutions CRM ${customer.id}`,
      });
      const base = displayName(customer.name);
      try {
        const { data } = await api("POST", "/customer", body(base), {
          requestid: createRequestId(ctx.realmId, "customer", customerId),
        });
        remote = (data as { Customer: { Id: string } }).Customer;
      } catch (error) {
        if (!(error instanceof QboError) || error.code !== "6240") throw error;
        const { data } = await api(
          "POST",
          "/customer",
          body(`${base} (${customer.id.slice(4, 12)})`),
          {
            requestid: createRequestId(
              ctx.realmId,
              "customer",
              customerId,
              "unique-name"
            ),
          }
        );
        remote = (data as { Customer: { Id: string } }).Customer;
      }
      message = `Created QuickBooks customer for ${customer.name}.`;
    }
    await saveLink(ctx.realmId, "customer", customerId, remote.Id, null);
    return { result: { remoteId: remote.Id, remoteNumber: null }, message };
  });
}

function serviceLabel(slug: string) {
  return (
    SERVICES.find(service => service.slug === slug)?.label ?? "Home service"
  );
}

export function createInvoice(jobId: string) {
  return withAccountingLock(jobs, jobId, () => createInvoiceUnlocked(jobId));
}

async function createInvoiceUnlocked(jobId: string) {
  const conn = await getConnection();
  if (!conn) throw new PublicError("QuickBooks is not connected.", 409);
  const existing = await findLink(conn.realmId, "invoice", jobId);
  if (existing) return existing;
  if (!conn.defaultItemId)
    throw new PublicError(
      "Choose a default QuickBooks product/service item on the Integrations page first.",
      409
    );
  const db = await database();
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  if (!job) throw new PublicError("Job not found.", 404);
  if (job.status === "cancelled")
    throw new PublicError("Cancelled jobs cannot be invoiced.", 409);
  const amount = Number(job.bookedAmount ?? job.quotedAmount ?? 0);
  if (!(amount > 0))
    throw new PublicError(
      "Add a quoted or accepted amount to the job before invoicing.",
      409
    );
  const customerLink = await syncCustomer(job.customerId);
  return run("create_invoice", jobId, async () => {
    const [customer] = await db
      .select({ email: customers.email })
      .from(customers)
      .where(eq(customers.id, job.customerId))
      .limit(1);
    const { data } = await api(
      "POST",
      "/invoice",
      {
        CustomerRef: { value: customerLink.remoteId },
        Line: [
          {
            DetailType: "SalesItemLineDetail",
            Amount: amount,
            Description: `${serviceLabel(job.service)}: ${job.summary}`.slice(
              0,
              4000
            ),
            SalesItemLineDetail: {
              ItemRef: { value: conn.defaultItemId },
              Qty: 1,
              UnitPrice: amount,
              ...(conn.defaultTaxCodeId
                ? { TaxCodeRef: { value: conn.defaultTaxCodeId } }
                : {}),
            },
          },
        ],
        ...(customer?.email ? { BillEmail: { Address: customer.email } } : {}),
        PrivateNote: `Seasonal Solutions job ${job.id}`,
      },
      { requestid: createRequestId(conn.realmId, "invoice", jobId) }
    );
    const invoice = (data as { Invoice: { Id: string; DocNumber?: string } })
      .Invoice;
    await saveLink(
      conn.realmId,
      "invoice",
      jobId,
      invoice.Id,
      invoice.DocNumber ?? null
    );
    return {
      result: { remoteId: invoice.Id, remoteNumber: invoice.DocNumber ?? null },
      message: `Created invoice ${invoice.DocNumber ?? invoice.Id} for $${amount.toFixed(2)}.`,
    };
  });
}

export function pushPayment(paymentId: string) {
  return withAccountingLock(payments, paymentId, () =>
    pushPaymentUnlocked(paymentId)
  );
}

async function pushPaymentUnlocked(paymentId: string) {
  const conn = await getConnection();
  if (!conn) throw new PublicError("QuickBooks is not connected.", 409);
  const existing = await findLink(conn.realmId, "payment", paymentId);
  if (existing) return existing;
  const db = await database();
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.id, paymentId))
    .limit(1);
  if (!payment) throw new PublicError("Payment not found.", 404);
  if (payment.kind !== "payment")
    throw new PublicError(
      "Refunds are recorded in QuickBooks manually (refund receipt).",
      409
    );
  const invoiceLink = await findLink(conn.realmId, "invoice", payment.jobId);
  if (!invoiceLink)
    throw new PublicError(
      "Create the QuickBooks invoice for this job first.",
      409
    );
  const [job] = await db
    .select({ customerId: jobs.customerId })
    .from(jobs)
    .where(eq(jobs.id, payment.jobId))
    .limit(1);
  const customerLink = await syncCustomer(job.customerId);
  return run("push_payment", paymentId, async () => {
    const amount = Number(payment.amount);
    const { data } = await api(
      "POST",
      "/payment",
      {
        TotalAmt: amount,
        CustomerRef: { value: customerLink.remoteId },
        TxnDate: winnipegDay(payment.recordedAt),
        ...(payment.reference
          ? { PaymentRefNum: payment.reference.slice(0, 21) }
          : {}),
        PrivateNote: `${payment.source === "stripe" ? "Stripe online payment" : "Recorded payment"} ${payment.id}`,
        Line: [
          {
            Amount: amount,
            LinkedTxn: [{ TxnId: invoiceLink.remoteId, TxnType: "Invoice" }],
          },
        ],
      },
      { requestid: createRequestId(conn.realmId, "payment", paymentId) }
    );
    const remote = (data as { Payment: { Id: string } }).Payment;
    await saveLink(conn.realmId, "payment", paymentId, remote.Id, null);
    return {
      result: { remoteId: remote.Id, remoteNumber: null },
      message: `Recorded $${amount.toFixed(2)} against invoice ${invoiceLink.remoteNumber ?? invoiceLink.remoteId}.`,
    };
  });
}

/** Pushes a new payment automatically when enabled; never throws. */
export async function autoPushPayment(paymentId: string) {
  try {
    const conn = await getConnection();
    if (!conn || !conn.autoSyncPayments || conn.status !== "connected") return;
    const db = await database();
    const [payment] = await db
      .select({ jobId: payments.jobId })
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);
    if (!payment || !(await findLink(conn.realmId, "invoice", payment.jobId))) {
      await logSync(
        "push_payment",
        paymentId,
        "error",
        "Automatic sync skipped: the job has no QuickBooks invoice yet."
      );
      return;
    }
    await pushPayment(paymentId);
  } catch {
    // Errors are already recorded in the sync log.
  }
}
