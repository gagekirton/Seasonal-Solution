/**
 * HANDOFF: Payment requests and the webhook fulfilment logic.
 * - CAD only; Stripe amounts are integer cents. Minimum payment is MIN_PAYMENT_CAD.
 * - `handleStripeEvent` is the ONLY place Stripe payments are written to the ledger. It is idempotent
 *   (stripe_events), locks rows, and throws on amount/currency mismatch so Stripe retries.
 * - Stripe network calls run inside DB transactions holding row locks; keep them short.
 */
import { randomBytes } from "crypto";
import { desc, eq } from "drizzle-orm";
import Stripe from "stripe";
import {
  customers,
  jobs,
  paymentRequests,
  payments,
  stripeEvents,
} from "../drizzle/schema";
import { BUSINESS, SERVICES } from "../shared/site";
import type { PublicPaymentRequest } from "../shared/content";
import { createCrmId } from "./crmDomain";
import { getDb } from "./db";

async function database() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db;
}

let client: Stripe | null = null;
let clientKey = "";

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (!key) throw new Error("Stripe is not configured");
  if (!client || clientKey !== key) {
    client = new Stripe(key, { timeout: 15000, maxNetworkRetries: 1 });
    clientKey = key;
  }
  return client;
}

export const MIN_PAYMENT_CAD = 0.5;

function serviceLabel(slug: string) {
  return (
    SERVICES.find(service => service.slug === slug)?.label ?? "Home service"
  );
}

export async function createPaymentRequest(input: {
  jobId: string;
  amount: string;
  description: string;
}) {
  const db = await database();
  const [job] = await db
    .select({ id: jobs.id, customerId: jobs.customerId, status: jobs.status })
    .from(jobs)
    .where(eq(jobs.id, input.jobId))
    .limit(1);
  if (!job) return { error: "not_found" as const };
  if (job.status === "cancelled") return { error: "job_cancelled" as const };
  const id = createCrmId("preq");
  const token = randomBytes(24).toString("base64url");
  await db.insert(paymentRequests).values({
    id,
    token,
    jobId: job.id,
    customerId: job.customerId,
    amount: input.amount,
    currency: "CAD",
    description: input.description,
    status: "open",
  });
  return { id, token };
}

export async function listPaymentRequests(limit = 200) {
  const db = await database();
  const rows = await db
    .select({
      id: paymentRequests.id,
      token: paymentRequests.token,
      jobId: paymentRequests.jobId,
      customerId: paymentRequests.customerId,
      amount: paymentRequests.amount,
      currency: paymentRequests.currency,
      description: paymentRequests.description,
      status: paymentRequests.status,
      lastError: paymentRequests.lastError,
      paymentIntentId: paymentRequests.paymentIntentId,
      ledgerPaymentId: paymentRequests.ledgerPaymentId,
      paidAt: paymentRequests.paidAt,
      createdAt: paymentRequests.createdAt,
      customerName: customers.name,
      customerEmail: customers.email,
      jobSummary: jobs.summary,
      jobService: jobs.service,
    })
    .from(paymentRequests)
    .innerJoin(customers, eq(paymentRequests.customerId, customers.id))
    .innerJoin(jobs, eq(paymentRequests.jobId, jobs.id))
    .orderBy(desc(paymentRequests.createdAt))
    .limit(Math.min(limit, 500));
  return rows.map(row => ({
    ...row,
    paidAt: row.paidAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function cancelPaymentRequest(id: string) {
  const db = await database();
  return db.transaction(async tx => {
    const [row] = await tx
      .select()
      .from(paymentRequests)
      .where(eq(paymentRequests.id, id))
      .limit(1)
      .for("update");
    if (!row) return "not_found" as const;
    if (row.status !== "open") return "not_open" as const;
    if (row.checkoutSessionId) {
      const session = await getStripe().checkout.sessions.retrieve(
        row.checkoutSessionId
      );
      // A completed checkout may still be awaiting its webhook. Never hide it.
      if (session.status === "complete") return "not_open" as const;
      if (session.status === "open")
        await getStripe().checkout.sessions.expire(session.id);
    }
    await tx
      .update(paymentRequests)
      .set({ status: "cancelled" })
      .where(eq(paymentRequests.id, id));
    return "cancelled" as const;
  });
}

async function findByToken(token: string) {
  const db = await database();
  const [row] = await db
    .select({
      request: paymentRequests,
      customerName: customers.name,
      customerEmail: customers.email,
      jobService: jobs.service,
    })
    .from(paymentRequests)
    .innerJoin(customers, eq(paymentRequests.customerId, customers.id))
    .innerJoin(jobs, eq(paymentRequests.jobId, jobs.id))
    .where(eq(paymentRequests.token, token))
    .limit(1);
  return row ?? null;
}

export async function getPublicPaymentRequest(
  token: string
): Promise<PublicPaymentRequest | null> {
  const row = await findByToken(token);
  if (!row) return null;
  const db = await database();
  const [receipt] = row.request.ledgerPaymentId
    ? await db
        .select({ amount: payments.amount })
        .from(payments)
        .where(eq(payments.id, row.request.ledgerPaymentId))
        .limit(1)
    : [];
  return {
    token,
    description: row.request.description,
    amount: Number(receipt?.amount ?? row.request.amount).toFixed(2),
    currency: row.request.currency,
    status: row.request.status,
    customerFirstName: row.customerName.trim().split(/\s+/)[0] ?? "",
    serviceLabel: serviceLabel(row.jobService),
    paidAt: row.request.paidAt?.toISOString() ?? null,
    stripeReady: stripeConfigured(),
  };
}

export async function createCheckoutForToken(token: string, origin: string) {
  const row = await findByToken(token);
  if (!row) return { error: "not_found" as const };
  const db = await database();
  return db.transaction(async tx => {
    const [request] = await tx
      .select()
      .from(paymentRequests)
      .where(eq(paymentRequests.id, row.request.id))
      .limit(1)
      .for("update");
    if (!request || request.status !== "open")
      return { error: "not_open" as const };
    if (request.checkoutSessionId) {
      const existing = await getStripe().checkout.sessions.retrieve(
        request.checkoutSessionId
      );
      if (existing.status === "open" && existing.url)
        return { url: existing.url };
      if (existing.status === "complete")
        return { error: "processing" as const };
    }
    const cents = Math.round(Number(request.amount) * 100);
    if (!Number.isSafeInteger(cents) || cents < MIN_PAYMENT_CAD * 100)
      return { error: "invalid_amount" as const };
    const metadata = {
      payment_request_id: row.request.id,
      job_id: row.request.jobId,
      customer_id: row.request.customerId,
      user_id: row.request.customerId,
      customer_email: row.customerEmail,
      customer_name: row.customerName,
    };
    const session = await getStripe().checkout.sessions.create(
      {
        mode: "payment",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "cad",
              unit_amount: cents,
              product_data: {
                name: row.request.description,
                description: `${BUSINESS.name} · ${serviceLabel(row.jobService)}`,
              },
            },
          },
        ],
        customer_email: row.customerEmail,
        client_reference_id: row.request.id,
        metadata,
        payment_intent_data: {
          metadata,
          description: `${BUSINESS.name}: ${row.request.description}`.slice(
            0,
            500
          ),
        },
        allow_promotion_codes: true,
        success_url: `${origin}/pay/${token}?checkout=success`,
        cancel_url: `${origin}/pay/${token}?checkout=cancelled`,
      },
      {
        idempotencyKey: `checkout:${request.id}:${request.checkoutSessionId ?? "initial"}`,
      }
    );
    await tx
      .update(paymentRequests)
      .set({ checkoutSessionId: session.id })
      .where(eq(paymentRequests.id, row.request.id));
    return { url: session.url };
  });
}

export type FulfillmentResult = {
  duplicate: boolean;
  fulfilled?: {
    paymentId: string;
    amount: string;
    customerName: string;
    description: string;
  };
};

function intentId(value: string | Stripe.PaymentIntent | null): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/** Records the event and fulfills a payment request exactly once. */
export async function handleStripeEvent(
  event: Stripe.Event
): Promise<FulfillmentResult> {
  const db = await database();
  return db.transaction(async tx => {
    const [seen] = await tx
      .select({ id: stripeEvents.id })
      .from(stripeEvents)
      .where(eq(stripeEvents.id, event.id))
      .limit(1);
    if (seen) return { duplicate: true };
    await tx
      .insert(stripeEvents)
      .values({ id: event.id, type: event.type.slice(0, 80) });

    let requestId: string | null = null;
    let paymentIntent: string | null = null;
    let amountCents: number | null = null;
    let currency: string | null = null;

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status !== "paid") return { duplicate: false };
      requestId =
        session.client_reference_id ??
        session.metadata?.payment_request_id ??
        null;
      paymentIntent = intentId(session.payment_intent);
      amountCents = session.amount_total;
      currency = session.currency;
    } else if (event.type === "payment_intent.succeeded") {
      const intent = event.data.object as Stripe.PaymentIntent;
      requestId = intent.metadata?.payment_request_id ?? null;
      paymentIntent = intent.id;
      amountCents = intent.amount_received;
      currency = intent.currency;
    } else if (event.type === "payment_intent.payment_failed") {
      const intent = event.data.object as Stripe.PaymentIntent;
      const failedRequest = intent.metadata?.payment_request_id;
      if (failedRequest)
        await tx
          .update(paymentRequests)
          .set({
            lastError: (
              intent.last_payment_error?.message ??
              "The payment attempt failed."
            ).slice(0, 300),
          })
          .where(eq(paymentRequests.id, failedRequest));
      return { duplicate: false };
    } else {
      return { duplicate: false };
    }

    if (!requestId || !paymentIntent || !amountCents)
      return { duplicate: false };
    const [request] = await tx
      .select()
      .from(paymentRequests)
      .where(eq(paymentRequests.id, requestId))
      .limit(1)
      .for("update");
    if (!request || request.status === "paid") return { duplicate: false };
    // Promotion codes can lower the collected amount; never relabel a foreign
    // currency or an amount above the fixed CAD request as a CAD receipt.
    if (
      currency?.toLowerCase() !== "cad" ||
      !Number.isSafeInteger(amountCents) ||
      amountCents > Math.round(Number(request.amount) * 100)
    ) {
      throw new Error(
        "Stripe payment currency or amount does not match the request"
      );
    }
    const [sameIntent] = await tx
      .select({ id: paymentRequests.id })
      .from(paymentRequests)
      .where(eq(paymentRequests.paymentIntentId, paymentIntent))
      .limit(1);
    if (sameIntent) return { duplicate: false };

    const paymentId = createCrmId("pay");
    const amount = (amountCents / 100).toFixed(2);
    const now = new Date();
    await tx.insert(payments).values({
      id: paymentId,
      jobId: request.jobId,
      kind: "payment",
      amount,
      currency: "CAD",
      recordedAt: now,
      reference: paymentIntent.slice(0, 120),
      note: "Paid online with Stripe Checkout",
      source: "stripe",
    });
    await tx
      .update(paymentRequests)
      .set({
        status: "paid",
        paymentIntentId: paymentIntent,
        ledgerPaymentId: paymentId,
        paidAt: now,
        lastError: null,
      })
      .where(eq(paymentRequests.id, request.id));
    const [customer] = await tx
      .select({ name: customers.name })
      .from(customers)
      .where(eq(customers.id, request.customerId))
      .limit(1);
    return {
      duplicate: false,
      fulfilled: {
        paymentId,
        amount,
        customerName: customer?.name ?? "A customer",
        description: request.description,
      },
    };
  });
}
