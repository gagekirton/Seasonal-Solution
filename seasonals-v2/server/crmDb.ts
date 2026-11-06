/**
 * HANDOFF: Leads, customers, jobs, payments ledger, follow-ups.
 * - One customer per normalized email; one lead per quote request.
 * - The public form is unauthenticated: it may only FILL BLANKS on an existing customer and must never
 *   reverse a recorded opt-out (tests in crmDb.test.ts). Do not relax this without an email-confirmation step.
 * - consent_events is append-only. 'Collected' = payments minus refunds; quotes are never revenue.
 */
import { and, count, desc, eq, inArray, like, lt, or, sql } from "drizzle-orm";
import {
  consentEvents,
  customers,
  followUps,
  jobs,
  leads,
  payments,
  type InsertLead,
} from "../drizzle/schema";
import {
  createCrmId,
  createCustomerId,
  hasCurrentMarketingConsent,
  isLatestContact,
  MARKETING_CONSENT_COPY,
  MARKETING_CONSENT_VERSION,
  netCollectedValue,
  normalizeCustomerEmail,
} from "./crmDomain";
import { getDb } from "./db";

async function database() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db;
}

function asMoneyNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

/** Insert the inquiry and create/link its customer atomically. */
export async function createLeadWithCustomer(
  lead: Omit<InsertLead, "customerId">,
  marketingOptIn: boolean
): Promise<string> {
  const db = await database();
  const receivedAt = lead.consentAt;
  const normalizedEmail = normalizeCustomerEmail(lead.email);
  const id = createCustomerId();

  return db.transaction(async tx => {
    const initialCustomer = {
      id,
      normalizedEmail,
      email: lead.email.trim(),
      name: lead.name.trim(),
      phone: lead.phone ?? null,
      serviceArea: lead.area ?? null,
      firstContactAt: receivedAt,
      lastContactAt: receivedAt,
      marketingConsentAt: null,
      marketingConsentSource: null,
      marketingConsentVersion: null,
      marketingOptOutAt: null,
    };
    await tx
      .insert(customers)
      .values(initialCustomer)
      .onDuplicateKeyUpdate({
        set: { id: sql`${customers.id}` },
      });
    const matches = await tx
      .select({
        id: customers.id,
        lastContactAt: customers.lastContactAt,
        phone: customers.phone,
        serviceArea: customers.serviceArea,
        marketingOptOutAt: customers.marketingOptOutAt,
      })
      .from(customers)
      .where(eq(customers.normalizedEmail, normalizedEmail))
      .limit(1)
      .for("update");
    const customerId = matches[0]?.id;
    if (!customerId)
      throw new Error("Could not link the inquiry to a customer");
    const now = new Date();
    const latest = isLatestContact(receivedAt, matches[0].lastContactAt);
    // The public form is unauthenticated: anyone can type a known customer's
    // email. It may fill blanks on an existing profile but never overwrite what
    // the owner has, and it never reverses a recorded opt-out. The inquiry
    // itself keeps exactly what was submitted.
    const existing = customerId !== id;
    const optedOut = Boolean(matches[0].marketingOptOutAt);
    const recordOptIn = marketingOptIn && !optedOut;
    await tx
      .update(customers)
      .set({
        firstContactAt: sql`LEAST(${customers.firstContactAt}, ${receivedAt})`,
        ...(latest ? { lastContactAt: receivedAt } : {}),
        ...(existing && !matches[0].phone && lead.phone
          ? { phone: lead.phone }
          : {}),
        ...(existing && !matches[0].serviceArea && lead.area
          ? { serviceArea: lead.area }
          : {}),
        ...(recordOptIn
          ? {
              marketingConsentAt: now,
              marketingConsentSource: "quote_form",
              marketingConsentVersion: MARKETING_CONSENT_VERSION,
            }
          : {}),
        updatedAt: now,
      })
      .where(eq(customers.id, customerId));

    if (recordOptIn)
      await tx.insert(consentEvents).values({
        id: createCrmId("evt"),
        customerId,
        kind: "opt_in",
        occurredAt: now,
        source: "quote_form",
        wordingVersion: MARKETING_CONSENT_VERSION,
        consentText: MARKETING_CONSENT_COPY,
      });
    await tx
      .insert(leads)
      .values({ ...lead, customerId, createdAt: receivedAt });
    return customerId;
  });
}

export type CustomerMetrics = {
  jobCount: number;
  completedJobCount: number;
  bookedValue: number;
  collectedValue: number;
};

async function metricsForCustomers(customerIds: string[]) {
  const db = await database();
  const result = new Map<string, CustomerMetrics>();
  for (const id of customerIds)
    result.set(id, {
      jobCount: 0,
      completedJobCount: 0,
      bookedValue: 0,
      collectedValue: 0,
    });
  if (customerIds.length === 0) return result;

  const jobRows = await db
    .select({
      customerId: jobs.customerId,
      jobCount: count(),
      completedJobCount: sql<number>`SUM(CASE WHEN ${jobs.status} = 'completed' THEN 1 ELSE 0 END)`,
      bookedValue: sql<string>`COALESCE(SUM(CASE WHEN ${jobs.status} IN ('booked', 'in_progress', 'completed') THEN COALESCE(${jobs.bookedAmount}, 0) ELSE 0 END), 0)`,
    })
    .from(jobs)
    .where(inArray(jobs.customerId, customerIds))
    .groupBy(jobs.customerId);
  for (const row of jobRows) {
    const current = result.get(row.customerId);
    if (!current) continue;
    current.jobCount = Number(row.jobCount);
    current.completedJobCount = Number(row.completedJobCount ?? 0);
    current.bookedValue = asMoneyNumber(row.bookedValue);
  }

  const paymentRows = await db
    .select({
      customerId: jobs.customerId,
      collectedValue: sql<string>`COALESCE(SUM(CASE WHEN ${payments.kind} = 'refund' THEN -${payments.amount} ELSE ${payments.amount} END), 0)`,
    })
    .from(payments)
    .innerJoin(jobs, eq(payments.jobId, jobs.id))
    .where(inArray(jobs.customerId, customerIds))
    .groupBy(jobs.customerId);
  for (const row of paymentRows) {
    const current = result.get(row.customerId);
    if (current) current.collectedValue = asMoneyNumber(row.collectedValue);
  }
  return result;
}

export async function listCrmCustomers(search = "", limit = 200) {
  const db = await database();
  const normalizedSearch = search.trim().slice(0, 100);
  const escapedSearch = normalizedSearch.replace(/[\\%_]/g, "\\$&");
  const predicate = normalizedSearch
    ? or(
        eq(customers.id, normalizedSearch),
        like(customers.name, `%${escapedSearch}%`),
        like(customers.email, `%${escapedSearch}%`),
        like(customers.normalizedEmail, `%${escapedSearch}%`),
        like(customers.phone, `%${escapedSearch}%`)
      )
    : undefined;
  const rows = await db
    .select({
      id: customers.id,
      email: customers.email,
      name: customers.name,
      phone: customers.phone,
      serviceArea: customers.serviceArea,
      firstContactAt: customers.firstContactAt,
      lastContactAt: customers.lastContactAt,
      marketingConsentAt: customers.marketingConsentAt,
      marketingConsentSource: customers.marketingConsentSource,
      marketingConsentVersion: customers.marketingConsentVersion,
      marketingOptOutAt: customers.marketingOptOutAt,
    })
    .from(customers)
    .where(predicate)
    .orderBy(desc(customers.lastContactAt))
    .limit(Math.min(Math.max(limit, 1), 500));
  const metrics = await metricsForCustomers(rows.map(row => row.id));
  return rows.map(row => ({
    ...row,
    ...(metrics.get(row.id) ?? {
      jobCount: 0,
      completedJobCount: 0,
      bookedValue: 0,
      collectedValue: 0,
    }),
  }));
}

export async function getCrmOverview() {
  const db = await database();
  const [customerCount] = await db.select({ total: count() }).from(customers);
  const repeatCustomers = await db
    .select({ customerId: jobs.customerId })
    .from(jobs)
    .where(eq(jobs.status, "completed"))
    .groupBy(jobs.customerId)
    .having(sql`COUNT(*) >= 2`);
  const [jobValues] = await db
    .select({
      bookedValue: sql<string>`COALESCE(SUM(CASE WHEN ${jobs.status} IN ('booked', 'in_progress', 'completed') THEN COALESCE(${jobs.bookedAmount}, 0) ELSE 0 END), 0)`,
    })
    .from(jobs);
  const [paymentValues] = await db
    .select({
      collectedValue: sql<string>`COALESCE(SUM(CASE WHEN ${payments.kind} = 'refund' THEN -${payments.amount} ELSE ${payments.amount} END), 0)`,
    })
    .from(payments);
  const [openFollowUps] = await db
    .select({ total: count() })
    .from(followUps)
    .where(eq(followUps.status, "open"));
  const [overdueFollowUps] = await db
    .select({ total: count() })
    .from(followUps)
    .where(and(eq(followUps.status, "open"), lt(followUps.dueAt, new Date())));
  return {
    customerCount: Number(customerCount?.total ?? 0),
    repeatCustomerCount: repeatCustomers.length,
    bookedValue: asMoneyNumber(jobValues?.bookedValue),
    collectedValue: asMoneyNumber(paymentValues?.collectedValue),
    openFollowUpCount: Number(openFollowUps?.total ?? 0),
    overdueFollowUpCount: Number(overdueFollowUps?.total ?? 0),
  };
}

export async function getCrmCustomer(customerId: string) {
  const db = await database();
  const [customer] = await db
    .select({
      id: customers.id,
      email: customers.email,
      name: customers.name,
      phone: customers.phone,
      serviceArea: customers.serviceArea,
      firstContactAt: customers.firstContactAt,
      lastContactAt: customers.lastContactAt,
      marketingConsentAt: customers.marketingConsentAt,
      marketingConsentSource: customers.marketingConsentSource,
      marketingConsentVersion: customers.marketingConsentVersion,
      marketingOptOutAt: customers.marketingOptOutAt,
      createdAt: customers.createdAt,
      updatedAt: customers.updatedAt,
    })
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1);
  if (!customer) return null;

  const [customerLeads, customerJobs, customerFollowUps] = await Promise.all([
    db
      .select()
      .from(leads)
      .where(eq(leads.customerId, customerId))
      .orderBy(desc(leads.createdAt))
      .limit(200),
    db
      .select()
      .from(jobs)
      .where(eq(jobs.customerId, customerId))
      .orderBy(desc(jobs.createdAt))
      .limit(200),
    db
      .select()
      .from(followUps)
      .where(eq(followUps.customerId, customerId))
      .orderBy(desc(followUps.dueAt))
      .limit(200),
  ]);
  const jobIds = customerJobs.map(job => job.id);
  const customerPayments = jobIds.length
    ? await db
        .select()
        .from(payments)
        .where(inArray(payments.jobId, jobIds))
        .orderBy(desc(payments.recordedAt))
    : [];
  const metrics = (await metricsForCustomers([customerId])).get(customerId)!;
  const consentHistory = await db
    .select()
    .from(consentEvents)
    .where(eq(consentEvents.customerId, customerId))
    .orderBy(desc(consentEvents.occurredAt))
    .limit(200);
  return {
    customer,
    metrics,
    consentHistory,
    leads: customerLeads,
    jobs: customerJobs.map(job => {
      const entries = customerPayments.filter(
        payment => payment.jobId === job.id
      );
      return {
        ...job,
        payments: entries,
        collectedValue: netCollectedValue(entries),
      };
    }),
    followUps: customerFollowUps,
  };
}

export async function updateCrmCustomer(
  customerId: string,
  patch: { name?: string; phone?: string | null; serviceArea?: string | null }
) {
  const db = await database();
  const result = await db
    .update(customers)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(customers.id, customerId));
  return Number(result[0]?.affectedRows ?? 0) > 0;
}

export async function recordMarketingOptOut(customerId: string) {
  const db = await database();
  return db.transaction(async tx => {
    const [existing] = await tx
      .select({
        id: customers.id,
        marketingOptOutAt: customers.marketingOptOutAt,
      })
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1)
      .for("update");
    if (!existing) return false;
    const now = new Date();
    if (!existing.marketingOptOutAt)
      await tx.insert(consentEvents).values({
        id: createCrmId("evt"),
        customerId,
        kind: "opt_out",
        occurredAt: now,
        source: "admin_customer_request",
        wordingVersion: null,
        consentText: null,
      });
    await tx
      .update(customers)
      .set({
        marketingOptOutAt: existing.marketingOptOutAt ?? now,
        updatedAt: now,
      })
      .where(eq(customers.id, customerId));
    await tx
      .update(followUps)
      .set({ status: "cancelled", completedAt: null })
      .where(
        and(
          eq(followUps.customerId, customerId),
          eq(followUps.type, "seasonal"),
          eq(followUps.status, "open")
        )
      );
    return true;
  });
}

export async function createCrmJob(input: {
  customerId: string;
  leadId: number | null;
  service: string;
  summary: string;
  quotedAmount: string | null;
  bookedAmount: string | null;
  status: "quoted" | "booked" | "in_progress" | "completed" | "cancelled";
  scheduledAt: Date | null;
}) {
  const db = await database();
  const [customer] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.id, input.customerId))
    .limit(1);
  if (!customer) return null;
  if (input.leadId !== null) {
    const [lead] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(
        and(eq(leads.id, input.leadId), eq(leads.customerId, input.customerId))
      )
      .limit(1);
    if (!lead) return null;
  }
  const id = createCrmId("job");
  const now = new Date();
  await db.insert(jobs).values({
    id,
    customerId: input.customerId,
    leadId: input.leadId,
    service: input.service,
    summary: input.summary,
    quotedAmount: input.quotedAmount,
    bookedAmount: input.bookedAmount,
    currency: "CAD",
    status: input.status,
    scheduledAt: input.scheduledAt,
    bookedAt: ["booked", "in_progress", "completed"].includes(input.status)
      ? now
      : null,
    completedAt: input.status === "completed" ? now : null,
  });
  return id;
}

export async function updateCrmJob(
  jobId: string,
  patch: {
    status?: "quoted" | "booked" | "in_progress" | "completed" | "cancelled";
    quotedAmount?: string | null;
    bookedAmount?: string | null;
    scheduledAt?: Date | null;
  }
) {
  const db = await database();
  const now = new Date();
  const result = await db
    .update(jobs)
    .set({
      ...patch,
      updatedAt: now,
      ...(patch.status &&
      ["booked", "in_progress", "completed"].includes(patch.status)
        ? { bookedAt: sql`COALESCE(${jobs.bookedAt}, ${now})` }
        : {}),
      ...(patch.status === "quoted" ? { bookedAmount: null } : {}),
      ...(patch.status === "completed" ? { completedAt: now } : {}),
      ...(patch.status && patch.status !== "completed"
        ? { completedAt: null }
        : {}),
    })
    .where(eq(jobs.id, jobId));
  return Number(result[0]?.affectedRows ?? 0) > 0;
}

export async function recordJobPayment(input: {
  jobId: string;
  kind: "payment" | "refund";
  amount: string;
  reference: string | null;
  note: string | null;
  source?: "manual" | "stripe";
}) {
  const db = await database();
  return db.transaction(async tx => {
    const [job] = await tx
      .select({ id: jobs.id })
      .from(jobs)
      .where(eq(jobs.id, input.jobId))
      .limit(1)
      .for("update");
    if (!job) return { error: "not_found" as const };
    const entries = await tx
      .select({
        kind: payments.kind,
        amount: payments.amount,
        source: payments.source,
      })
      .from(payments)
      .where(eq(payments.jobId, input.jobId));
    if (
      input.kind === "refund" &&
      Number(input.amount) >
        netCollectedValue(
          entries.filter(entry => entry.source === (input.source ?? "manual"))
        )
    )
      return { error: "refund_exceeds_balance" as const };
    const id = createCrmId("pay");
    await tx.insert(payments).values({
      id,
      jobId: input.jobId,
      kind: input.kind,
      amount: input.amount,
      currency: "CAD",
      recordedAt: new Date(),
      reference: input.reference,
      note: input.note,
      source: input.kind === "refund" ? (input.source ?? "manual") : "manual",
    });
    return { id };
  });
}

export async function createCrmFollowUp(input: {
  customerId: string;
  leadId: number | null;
  jobId: string | null;
  type: "quote" | "service" | "seasonal";
  title: string;
  note: string | null;
  dueAt: Date;
}) {
  const db = await database();
  return db.transaction(async tx => {
    const [customer] = await tx
      .select({
        id: customers.id,
        marketingConsentAt: customers.marketingConsentAt,
        marketingOptOutAt: customers.marketingOptOutAt,
      })
      .from(customers)
      .where(eq(customers.id, input.customerId))
      .limit(1)
      .for("update");
    if (!customer) return null;
    if (input.type === "seasonal" && !hasCurrentMarketingConsent(customer))
      return { consentRequired: true as const };
    if (input.leadId !== null) {
      const [lead] = await tx
        .select({ id: leads.id })
        .from(leads)
        .where(
          and(
            eq(leads.id, input.leadId),
            eq(leads.customerId, input.customerId)
          )
        )
        .limit(1);
      if (!lead) return null;
    }
    if (input.jobId !== null) {
      const [job] = await tx
        .select({ id: jobs.id })
        .from(jobs)
        .where(
          and(eq(jobs.id, input.jobId), eq(jobs.customerId, input.customerId))
        )
        .limit(1);
      if (!job) return null;
    }
    const id = createCrmId("task");
    await tx.insert(followUps).values({
      id,
      customerId: input.customerId,
      leadId: input.leadId,
      jobId: input.jobId,
      type: input.type,
      title: input.title,
      note: input.note,
      dueAt: input.dueAt,
      status: "open",
    });
    return { id };
  });
}

export async function listCrmFollowUps(
  status: "open" | "overdue" | "completed" | "cancelled" | "all" = "open"
) {
  const db = await database();
  const rows = await db
    .select({
      id: followUps.id,
      customerId: followUps.customerId,
      customerName: customers.name,
      customerEmail: customers.email,
      leadId: followUps.leadId,
      jobId: followUps.jobId,
      type: followUps.type,
      title: followUps.title,
      note: followUps.note,
      dueAt: followUps.dueAt,
      status: followUps.status,
      createdAt: followUps.createdAt,
      completedAt: followUps.completedAt,
    })
    .from(followUps)
    .innerJoin(customers, eq(followUps.customerId, customers.id))
    .where(
      status === "all"
        ? undefined
        : status === "overdue"
          ? and(eq(followUps.status, "open"), lt(followUps.dueAt, new Date()))
          : eq(followUps.status, status)
    )
    .orderBy(followUps.status, followUps.dueAt)
    .limit(500);
  return rows;
}

export async function updateCrmFollowUp(
  id: string,
  status: "open" | "completed" | "cancelled"
) {
  const db = await database();
  return db.transaction(async tx => {
    const [task] = await tx
      .select({ customerId: followUps.customerId, type: followUps.type })
      .from(followUps)
      .where(eq(followUps.id, id))
      .limit(1);
    if (!task) return false;
    if (status === "open" && task.type === "seasonal") {
      const [customer] = await tx
        .select({
          marketingConsentAt: customers.marketingConsentAt,
          marketingOptOutAt: customers.marketingOptOutAt,
        })
        .from(customers)
        .where(eq(customers.id, task.customerId))
        .limit(1)
        .for("update");
      if (!customer || !hasCurrentMarketingConsent(customer))
        return { consentRequired: true as const };
    }
    const now = new Date();
    await tx
      .update(followUps)
      .set({ status, completedAt: status === "completed" ? now : null })
      .where(eq(followUps.id, id));
    return true;
  });
}
