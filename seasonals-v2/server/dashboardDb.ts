/**
 * HANDOFF: Aggregates for the owner dashboard (ranges 7/30/90/365 days) and `getAlertCounts` for the alerts bell.
 * Revenue = payments minus refunds. Keep queries cheap: this runs on every dashboard load.
 */
import { and, asc, count, desc, eq, gte, like, lt, or, sql } from "drizzle-orm";
import {
  customers,
  followUps,
  integrationConnections,
  jobs,
  leads,
  pageViewDaily,
  paymentRequests,
  payments,
  sessionSourceDaily,
  type LeadStatus,
} from "../drizzle/schema";
import { getDb } from "./db";
import { winnipegDay } from "./analytics";
import { winnipegDayStart } from "./dashboardDates";

async function database() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db;
}

const money = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
};

function shiftDay(day: string, offset: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

/** UTC instant for the start of a Winnipeg calendar day. */
function dayStart(day: string): Date {
  return winnipegDayStart(day);
}

export const DASHBOARD_RANGES = [7, 30, 90, 365] as const;

type Period = { startDay: string; endDay: string; start: Date; end: Date };

function period(endDay: string, days: number): Period {
  const startDay = shiftDay(endDay, -(days - 1));
  return {
    startDay,
    endDay,
    start: dayStart(startDay),
    end: dayStart(shiftDay(endDay, 1)),
  };
}

async function periodKpis(p: Period) {
  const db = await database();
  const [[views], [visits], [leadCount], [newCustomers], [booked], paid] =
    await Promise.all([
      db
        .select({
          total: sql<string>`COALESCE(SUM(${pageViewDaily.views}), 0)`,
        })
        .from(pageViewDaily)
        .where(
          and(
            gte(pageViewDaily.day, p.startDay),
            sql`${pageViewDaily.day} <= ${p.endDay}`
          )
        ),
      db
        .select({
          total: sql<string>`COALESCE(SUM(${sessionSourceDaily.sessions}), 0)`,
        })
        .from(sessionSourceDaily)
        .where(
          and(
            gte(sessionSourceDaily.day, p.startDay),
            sql`${sessionSourceDaily.day} <= ${p.endDay}`
          )
        ),
      db
        .select({ total: count() })
        .from(leads)
        .where(and(gte(leads.createdAt, p.start), lt(leads.createdAt, p.end))),
      db
        .select({ total: count() })
        .from(customers)
        .where(
          and(
            gte(customers.firstContactAt, p.start),
            lt(customers.firstContactAt, p.end)
          )
        ),
      db
        .select({
          total: count(),
          value: sql<string>`COALESCE(SUM(COALESCE(${jobs.bookedAmount}, 0)), 0)`,
        })
        .from(jobs)
        .where(
          and(
            gte(jobs.bookedAt, p.start),
            lt(jobs.bookedAt, p.end),
            sql`${jobs.status} IN ('booked', 'in_progress', 'completed')`
          )
        ),
      db
        .select({
          source: payments.source,
          net: sql<string>`COALESCE(SUM(CASE WHEN ${payments.kind} = 'refund' THEN -${payments.amount} ELSE ${payments.amount} END), 0)`,
        })
        .from(payments)
        .where(
          and(gte(payments.recordedAt, p.start), lt(payments.recordedAt, p.end))
        )
        .groupBy(payments.source),
    ]);
  const online = money(paid.find(row => row.source === "stripe")?.net);
  const manual = money(paid.find(row => row.source === "manual")?.net);
  const pageViews = Number(views?.total ?? 0);
  const sessionCount = Number(visits?.total ?? 0);
  const leadTotal = Number(leadCount?.total ?? 0);
  return {
    pageViews,
    visits: sessionCount,
    leads: leadTotal,
    conversionRate:
      sessionCount > 0
        ? Math.round((leadTotal / sessionCount) * 1000) / 10
        : null,
    newCustomers: Number(newCustomers?.total ?? 0),
    jobsBooked: Number(booked?.total ?? 0),
    bookedValue: money(booked?.value),
    collectedValue: money(online + manual),
    onlineCollected: online,
    manualCollected: manual,
  };
}

export async function getDashboard(rangeDays: number) {
  const db = await database();
  const today = winnipegDay();
  const current = period(today, rangeDays);
  const previous = period(shiftDay(current.startDay, -1), rangeDays);

  const [kpis, previousKpis] = await Promise.all([
    periodKpis(current),
    periodKpis(previous),
  ]);

  const [viewRows, visitRows, leadRows, topPages, sources] = await Promise.all([
    db
      .select({
        day: pageViewDaily.day,
        views: sql<string>`SUM(${pageViewDaily.views})`,
      })
      .from(pageViewDaily)
      .where(
        and(
          gte(pageViewDaily.day, current.startDay),
          sql`${pageViewDaily.day} <= ${current.endDay}`
        )
      )
      .groupBy(pageViewDaily.day),
    db
      .select({
        day: sessionSourceDaily.day,
        visits: sql<string>`SUM(${sessionSourceDaily.sessions})`,
      })
      .from(sessionSourceDaily)
      .where(
        and(
          gte(sessionSourceDaily.day, current.startDay),
          sql`${sessionSourceDaily.day} <= ${current.endDay}`
        )
      )
      .groupBy(sessionSourceDaily.day),
    db
      .select({
        createdAt: leads.createdAt,
        service: leads.service,
        status: leads.status,
        utmSource: leads.utmSource,
        utmMedium: leads.utmMedium,
      })
      .from(leads)
      .where(
        and(
          gte(leads.createdAt, current.start),
          lt(leads.createdAt, current.end)
        )
      )
      .limit(5000),
    db
      .select({
        path: pageViewDaily.path,
        views: sql<string>`SUM(${pageViewDaily.views})`,
      })
      .from(pageViewDaily)
      .where(
        and(
          gte(pageViewDaily.day, current.startDay),
          sql`${pageViewDaily.day} <= ${current.endDay}`
        )
      )
      .groupBy(pageViewDaily.path)
      .orderBy(desc(sql`SUM(${pageViewDaily.views})`))
      .limit(10),
    db
      .select({
        source: sessionSourceDaily.source,
        medium: sessionSourceDaily.medium,
        visits: sql<string>`SUM(${sessionSourceDaily.sessions})`,
      })
      .from(sessionSourceDaily)
      .where(
        and(
          gte(sessionSourceDaily.day, current.startDay),
          sql`${sessionSourceDaily.day} <= ${current.endDay}`
        )
      )
      .groupBy(sessionSourceDaily.source, sessionSourceDaily.medium)
      .orderBy(desc(sql`SUM(${sessionSourceDaily.sessions})`))
      .limit(10),
  ]);

  const dayKey = (value: unknown) => String(value).slice(0, 10);
  const viewsByDay = new Map(
    viewRows.map(row => [dayKey(row.day), Number(row.views)])
  );
  const visitsByDay = new Map(
    visitRows.map(row => [dayKey(row.day), Number(row.visits)])
  );
  const leadsByDay = new Map<string, number>();
  const byService = new Map<string, number>();
  const bySource = new Map<string, number>();
  const pipeline: Record<LeadStatus, number> = {
    new: 0,
    contacted: 0,
    quoted: 0,
    won: 0,
    lost: 0,
    closed: 0,
  };
  for (const lead of leadRows) {
    const day = winnipegDay(lead.createdAt);
    leadsByDay.set(day, (leadsByDay.get(day) ?? 0) + 1);
    byService.set(lead.service, (byService.get(lead.service) ?? 0) + 1);
    const source = lead.utmSource
      ? `${lead.utmSource}${lead.utmMedium ? ` / ${lead.utmMedium}` : ""}`
      : "Website (untagged)";
    bySource.set(source, (bySource.get(source) ?? 0) + 1);
    pipeline[lead.status] += 1;
  }
  const daily: Array<{
    day: string;
    views: number;
    visits: number;
    leads: number;
  }> = [];
  for (
    let day = current.startDay;
    day <= current.endDay;
    day = shiftDay(day, 1)
  )
    daily.push({
      day,
      views: viewsByDay.get(day) ?? 0,
      visits: visitsByDay.get(day) ?? 0,
      leads: leadsByDay.get(day) ?? 0,
    });

  const revenueStart = dayStart(`${shiftDay(today, -365).slice(0, 7)}-01`);
  const revenueRows = await db
    .select({
      recordedAt: payments.recordedAt,
      kind: payments.kind,
      amount: payments.amount,
      source: payments.source,
    })
    .from(payments)
    .where(gte(payments.recordedAt, revenueStart))
    .limit(10000);
  const months = new Map<string, { online: number; manual: number }>();
  for (let i = 11; i >= 0; i -= 1) {
    const [year, month] = today.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1 - i, 1));
    months.set(date.toISOString().slice(0, 7), { online: 0, manual: 0 });
  }
  for (const row of revenueRows) {
    const month = winnipegDay(row.recordedAt).slice(0, 7);
    const bucket = months.get(month);
    if (!bucket) continue;
    const signed = (row.kind === "refund" ? -1 : 1) * Number(row.amount);
    if (row.source === "stripe") bucket.online += signed;
    else bucket.manual += signed;
  }

  const [
    [openFollowUps],
    [overdueFollowUps],
    needsResponse,
    recentPayments,
    [qbo],
  ] = await Promise.all([
    db
      .select({ total: count() })
      .from(followUps)
      .where(eq(followUps.status, "open")),
    db
      .select({ total: count() })
      .from(followUps)
      .where(
        and(eq(followUps.status, "open"), lt(followUps.dueAt, new Date()))
      ),
    db
      .select({
        id: leads.id,
        name: leads.name,
        service: leads.service,
        area: leads.area,
        phone: leads.phone,
        email: leads.email,
        customerId: leads.customerId,
        createdAt: leads.createdAt,
      })
      .from(leads)
      .where(eq(leads.status, "new"))
      .orderBy(asc(leads.createdAt))
      .limit(8),
    db
      .select({
        id: payments.id,
        kind: payments.kind,
        amount: payments.amount,
        source: payments.source,
        recordedAt: payments.recordedAt,
        customerName: customers.name,
        customerId: customers.id,
      })
      .from(payments)
      .innerJoin(jobs, eq(payments.jobId, jobs.id))
      .innerJoin(customers, eq(jobs.customerId, customers.id))
      .orderBy(desc(payments.recordedAt))
      .limit(6),
    db
      .select({
        status: integrationConnections.status,
        companyName: integrationConnections.companyName,
        environment: integrationConnections.environment,
      })
      .from(integrationConnections)
      .where(eq(integrationConnections.provider, "quickbooks"))
      .limit(1),
  ]);
  const [[newLeadTotal]] = await Promise.all([
    db.select({ total: count() }).from(leads).where(eq(leads.status, "new")),
  ]);

  const stripeKey = process.env.STRIPE_SECRET_KEY ?? "";
  return {
    range: rangeDays,
    period: { start: current.startDay, end: current.endDay },
    kpis,
    previous: previousKpis,
    daily,
    pipeline,
    leadsByService: [...byService.entries()]
      .map(([service, total]) => ({ service, total }))
      .sort((a, b) => b.total - a.total),
    leadsBySource: [...bySource.entries()]
      .map(([source, total]) => ({ source, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8),
    topPages: topPages.map(row => ({
      path: row.path,
      views: Number(row.views),
    })),
    trafficSources: sources.map(row => ({
      source: row.source,
      medium: row.medium,
      visits: Number(row.visits),
    })),
    revenueByMonth: [...months.entries()].map(([month, value]) => ({
      month,
      online: money(value.online),
      manual: money(value.manual),
    })),
    followUps: {
      open: Number(openFollowUps?.total ?? 0),
      overdue: Number(overdueFollowUps?.total ?? 0),
    },
    needsResponse: {
      total: Number(newLeadTotal?.total ?? 0),
      leads: needsResponse.map(lead => ({
        ...lead,
        createdAt: lead.createdAt.toISOString(),
      })),
    },
    recentPayments: recentPayments.map(row => ({
      ...row,
      amount: money(row.amount),
      recordedAt: row.recordedAt.toISOString(),
    })),
    integrations: {
      stripe: {
        configured: Boolean(stripeKey),
        mode: stripeKey.startsWith("sk_live") ? "live" : "test",
      },
      quickbooks: {
        configured: Boolean(
          process.env.QUICKBOOKS_CLIENT_ID &&
            process.env.QUICKBOOKS_CLIENT_SECRET
        ),
        status: qbo?.status ?? "not_connected",
        companyName: qbo?.companyName ?? null,
        environment: qbo?.environment ?? null,
      },
    },
  };
}

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "quoted",
  "won",
  "lost",
  "closed",
] as const;

export async function searchLeads(options: {
  q?: string;
  status?: LeadStatus;
  service?: string;
  limit?: number;
}) {
  const db = await database();
  const filters = [];
  if (options.status) filters.push(eq(leads.status, options.status));
  if (options.service) filters.push(eq(leads.service, options.service));
  const q = (options.q ?? "").trim().slice(0, 100);
  if (q) {
    const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
    filters.push(
      or(
        like(leads.name, pattern),
        like(leads.email, pattern),
        like(leads.phone, pattern),
        like(leads.area, pattern),
        like(leads.details, pattern)
      )!
    );
  }
  const where = filters.length ? and(...filters) : undefined;
  const [rows, counts] = await Promise.all([
    db
      .select()
      .from(leads)
      .where(where)
      .orderBy(desc(leads.createdAt))
      .limit(Math.min(Math.max(options.limit ?? 100, 1), 500)),
    db
      .select({ status: leads.status, total: count() })
      .from(leads)
      .groupBy(leads.status),
  ]);
  const statusCounts = Object.fromEntries(
    LEAD_STATUSES.map(status => [
      status,
      Number(counts.find(row => row.status === status)?.total ?? 0),
    ])
  );
  return { leads: rows, statusCounts };
}

export async function updateLead(
  id: number,
  patch: { status?: LeadStatus; internalNote?: string | null }
) {
  const db = await database();
  const result = await db
    .update(leads)
    .set({
      ...patch,
      ...(patch.status ? { statusChangedAt: new Date() } : {}),
    })
    .where(eq(leads.id, id));
  return Number(result[0]?.affectedRows ?? 0) > 0;
}

/** Cheap counts for the dashboard bell; avoids running the full dashboard query on every page. */
export async function getAlertCounts() {
  const db = await database();
  const [[newLeads], [overdue], [openRequests], [qbo]] = await Promise.all([
    db.select({ total: count() }).from(leads).where(eq(leads.status, "new")),
    db
      .select({ total: count() })
      .from(followUps)
      .where(
        and(eq(followUps.status, "open"), lt(followUps.dueAt, new Date()))
      ),
    db
      .select({ total: count() })
      .from(paymentRequests)
      .where(eq(paymentRequests.status, "open")),
    db
      .select({ status: integrationConnections.status })
      .from(integrationConnections)
      .where(eq(integrationConnections.provider, "quickbooks"))
      .limit(1),
  ]);
  return {
    newLeads: Number(newLeads?.total ?? 0),
    overdueFollowUps: Number(overdue?.total ?? 0),
    openPaymentRequests: Number(openRequests?.total ?? 0),
    quickbooksNeedsReconnect: qbo?.status === "needs_reconnect",
    stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
  };
}
