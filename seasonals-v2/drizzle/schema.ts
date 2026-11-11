/**
 * HANDOFF: Database schema. Changes must be ADDITIVE; run `pnpm db:push`; never edit applied files in drizzle/.
 * customers.normalizedEmail is unique. Foreign keys restrict deletes, so customers with history cannot be deleted
 * (NEXT-TASKS T10). consent_events is append-only.
 */
import {
  boolean,
  date,
  decimal,
  foreignKey,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/** Local accounts used for owner-only administration (email + password sign-in since the 2026-11-11 rebuild). */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

/** Private CRM contact profile, keyed internally rather than by PII. */
export const customers = mysqlTable("customers", {
  id: varchar("id", { length: 40 }).primaryKey(),
  normalizedEmail: varchar("normalizedEmail", { length: 320 })
    .notNull()
    .unique(),
  email: varchar("email", { length: 320 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 40 }),
  serviceArea: varchar("serviceArea", { length: 120 }),
  firstContactAt: timestamp("firstContactAt", { fsp: 3 }).notNull(),
  lastContactAt: timestamp("lastContactAt", { fsp: 3 }).notNull(),
  marketingConsentAt: timestamp("marketingConsentAt"),
  marketingConsentSource: varchar("marketingConsentSource", { length: 40 }),
  marketingConsentVersion: varchar("marketingConsentVersion", { length: 40 }),
  marketingOptOutAt: timestamp("marketingOptOutAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Each submitted project remains its own record, linked to a CRM customer. */
export const leads = mysqlTable(
  "leads",
  {
    id: int("id").autoincrement().primaryKey(),
    customerId: varchar("customerId", { length: 40 }),
    name: varchar("name", { length: 100 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    phone: varchar("phone", { length: 40 }),
    service: varchar("service", { length: 32 }).notNull(),
    area: varchar("area", { length: 120 }),
    projectType: mysqlEnum("projectType", [
      "residential",
      "commercial",
    ]).notNull(),
    details: text("details").notNull(),
    consentAt: timestamp("consentAt").notNull(),
    sourcePath: varchar("sourcePath", { length: 255 }),
    landingPath: varchar("landingPath", { length: 255 }),
    utmSource: varchar("utmSource", { length: 120 }),
    utmMedium: varchar("utmMedium", { length: 120 }),
    utmCampaign: varchar("utmCampaign", { length: 160 }),
    status: mysqlEnum("status", [
      "new",
      "contacted",
      "closed",
      "quoted",
      "won",
      "lost",
    ])
      .default("new")
      .notNull(),
    internalNote: varchar("internalNote", { length: 1000 }),
    statusChangedAt: timestamp("statusChangedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("leads_customer_id_idx").on(table.customerId),
    index("leads_created_idx").on(table.createdAt),
    foreignKey({
      columns: [table.customerId],
      foreignColumns: [customers.id],
      name: "leads_customer_id_fk",
    }).onDelete("restrict"),
  ]
);

/** A customer may have multiple quoted, booked or completed service jobs. */
export const jobs = mysqlTable(
  "jobs",
  {
    id: varchar("id", { length: 40 }).primaryKey(),
    customerId: varchar("customerId", { length: 40 })
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    leadId: int("leadId").references(() => leads.id, { onDelete: "set null" }),
    service: varchar("service", { length: 32 }).notNull(),
    summary: varchar("summary", { length: 2000 }).notNull(),
    quotedAmount: decimal("quotedAmount", { precision: 10, scale: 2 }),
    bookedAmount: decimal("bookedAmount", { precision: 10, scale: 2 }),
    currency: varchar("currency", { length: 3 }).default("CAD").notNull(),
    status: mysqlEnum("status", [
      "quoted",
      "booked",
      "in_progress",
      "completed",
      "cancelled",
    ])
      .default("quoted")
      .notNull(),
    scheduledAt: timestamp("scheduledAt"),
    bookedAt: timestamp("bookedAt", { fsp: 3 }),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("jobs_customer_id_idx").on(table.customerId)]
);

/** Append-only received-payment/refund ledger; never store card details. */
export const payments = mysqlTable(
  "payments",
  {
    id: varchar("id", { length: 40 }).primaryKey(),
    jobId: varchar("jobId", { length: 40 })
      .notNull()
      .references(() => jobs.id, { onDelete: "restrict" }),
    kind: mysqlEnum("kind", ["payment", "refund"]).notNull(),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("CAD").notNull(),
    recordedAt: timestamp("recordedAt").notNull(),
    reference: varchar("reference", { length: 120 }),
    note: varchar("note", { length: 1000 }),
    source: mysqlEnum("source", ["manual", "stripe"])
      .default("manual")
      .notNull(),
  },
  table => [
    index("payments_job_id_idx").on(table.jobId),
    index("payments_recorded_idx").on(table.recordedAt),
  ]
);

/** Private, owner-managed reminders; the system does not send messages. */
export const followUps = mysqlTable(
  "follow_ups",
  {
    id: varchar("id", { length: 41 }).primaryKey(),
    customerId: varchar("customerId", { length: 40 })
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    leadId: int("leadId").references(() => leads.id, { onDelete: "set null" }),
    jobId: varchar("jobId", { length: 40 }).references(() => jobs.id, {
      onDelete: "set null",
    }),
    type: mysqlEnum("type", ["quote", "service", "seasonal"]).notNull(),
    title: varchar("title", { length: 140 }).notNull(),
    note: varchar("note", { length: 1000 }),
    dueAt: timestamp("dueAt").notNull(),
    status: mysqlEnum("status", ["open", "completed", "cancelled"])
      .default("open")
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    completedAt: timestamp("completedAt"),
  },
  table => [
    index("followups_customer_id_idx").on(table.customerId),
    index("followups_status_due_idx").on(table.status, table.dueAt),
  ]
);

/** Immutable consent evidence; current profile fields are convenience state. */
export const consentEvents = mysqlTable(
  "consent_events",
  {
    id: varchar("id", { length: 40 }).primaryKey(),
    customerId: varchar("customerId", { length: 40 })
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    kind: mysqlEnum("kind", ["opt_in", "opt_out"]).notNull(),
    occurredAt: timestamp("occurredAt", { fsp: 3 }).notNull(),
    source: varchar("source", { length: 40 }).notNull(),
    wordingVersion: varchar("wordingVersion", { length: 40 }),
    consentText: text("consentText"),
  },
  table => [
    index("consent_events_customer_idx").on(table.customerId, table.occurredAt),
  ]
);

/** Owner-authored public posts (tips, project write-ups and news). */
export const posts = mysqlTable(
  "posts",
  {
    id: varchar("id", { length: 41 }).primaryKey(),
    slug: varchar("slug", { length: 120 }).notNull(),
    title: varchar("title", { length: 140 }).notNull(),
    excerpt: varchar("excerpt", { length: 320 }).notNull(),
    body: text("body").notNull(),
    category: mysqlEnum("category", ["tips", "project", "news"])
      .default("tips")
      .notNull(),
    serviceSlug: varchar("serviceSlug", { length: 32 }),
    areaName: varchar("areaName", { length: 120 }),
    coverImageUrl: varchar("coverImageUrl", { length: 512 }),
    coverImageAlt: varchar("coverImageAlt", { length: 200 }),
    seoTitle: varchar("seoTitle", { length: 80 }),
    seoDescription: varchar("seoDescription", { length: 180 }),
    status: mysqlEnum("status", ["draft", "published"])
      .default("draft")
      .notNull(),
    publishedAt: timestamp("publishedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("posts_slug_unique").on(table.slug),
    index("posts_status_published_idx").on(table.status, table.publishedAt),
  ]
);

/** Index of owner-uploaded images stored in project storage. */
export const mediaAssets = mysqlTable("media_assets", {
  id: varchar("id", { length: 41 }).primaryKey(),
  storageKey: varchar("storageKey", { length: 255 }).notNull(),
  url: varchar("url", { length: 512 }).notNull(),
  contentType: varchar("contentType", { length: 40 }).notNull(),
  byteSize: int("byteSize").notNull(),
  originalName: varchar("originalName", { length: 160 }),
  uploadedBy: varchar("uploadedBy", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** Aggregate public page views per Winnipeg calendar day; no visitor data. */
export const pageViewDaily = mysqlTable(
  "page_view_daily",
  {
    day: date("day", { mode: "string" }).notNull(),
    path: varchar("path", { length: 160 }).notNull(),
    views: int("views").default(0).notNull(),
  },
  table => [primaryKey({ columns: [table.day, table.path] })]
);

/** Aggregate landing visits per day and traffic source; no visitor data. */
export const sessionSourceDaily = mysqlTable(
  "session_source_daily",
  {
    day: date("day", { mode: "string" }).notNull(),
    source: varchar("source", { length: 100 }).notNull(),
    medium: varchar("medium", { length: 40 }).notNull(),
    sessions: int("sessions").default(0).notNull(),
  },
  table => [
    primaryKey({ columns: [table.day, table.source, table.medium] }),
  ]
);

/** Owner-issued online payment requests paid through Stripe Checkout. */
export const paymentRequests = mysqlTable(
  "payment_requests",
  {
    id: varchar("id", { length: 41 }).primaryKey(),
    token: varchar("token", { length: 64 }).notNull(),
    jobId: varchar("jobId", { length: 40 })
      .notNull()
      .references(() => jobs.id, { onDelete: "restrict" }),
    customerId: varchar("customerId", { length: 40 })
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("CAD").notNull(),
    description: varchar("description", { length: 200 }).notNull(),
    status: mysqlEnum("status", ["open", "paid", "cancelled"])
      .default("open")
      .notNull(),
    checkoutSessionId: varchar("checkoutSessionId", { length: 255 }),
    paymentIntentId: varchar("paymentIntentId", { length: 255 }),
    ledgerPaymentId: varchar("ledgerPaymentId", { length: 40 }),
    lastError: varchar("lastError", { length: 300 }),
    paidAt: timestamp("paidAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("payment_requests_token_unique").on(table.token),
    uniqueIndex("payment_requests_intent_unique").on(table.paymentIntentId),
    index("payment_requests_job_idx").on(table.jobId),
  ]
);

/** Processed Stripe webhook event IDs for idempotent fulfillment. */
export const stripeEvents = mysqlTable("stripe_events", {
  id: varchar("id", { length: 255 }).primaryKey(),
  type: varchar("type", { length: 80 }).notNull(),
  processedAt: timestamp("processedAt").defaultNow().notNull(),
});

/** Accounting connection; tokens are encrypted before storage. */
export const integrationConnections = mysqlTable("integration_connections", {
  provider: varchar("provider", { length: 20 }).primaryKey(),
  environment: mysqlEnum("environment", ["sandbox", "production"]).notNull(),
  realmId: varchar("realmId", { length: 32 }).notNull(),
  companyName: varchar("companyName", { length: 200 }),
  accessTokenEnc: text("accessTokenEnc").notNull(),
  refreshTokenEnc: text("refreshTokenEnc").notNull(),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt").notNull(),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  status: mysqlEnum("status", ["connected", "needs_reconnect"])
    .default("connected")
    .notNull(),
  defaultItemId: varchar("defaultItemId", { length: 32 }),
  defaultItemName: varchar("defaultItemName", { length: 120 }),
  defaultTaxCodeId: varchar("defaultTaxCodeId", { length: 32 }),
  defaultTaxCodeName: varchar("defaultTaxCodeName", { length: 120 }),
  autoSyncPayments: boolean("autoSyncPayments").default(false).notNull(),
  connectedAt: timestamp("connectedAt").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Single-use OAuth state values (stored as SHA-256 hashes). */
export const oauthStates = mysqlTable("oauth_states", {
  stateHash: varchar("stateHash", { length: 64 }).primaryKey(),
  provider: varchar("provider", { length: 20 }).notNull(),
  environment: mysqlEnum("environment", ["sandbox", "production"]).notNull(),
  redirectUri: varchar("redirectUri", { length: 512 }).notNull(),
  createdBy: varchar("createdBy", { length: 64 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** Mapping from local CRM records to accounting records per company realm. */
export const accountingLinks = mysqlTable(
  "accounting_links",
  {
    realmId: varchar("realmId", { length: 32 }).notNull(),
    entityType: mysqlEnum("entityType", [
      "customer",
      "invoice",
      "payment",
    ]).notNull(),
    localId: varchar("localId", { length: 41 }).notNull(),
    remoteId: varchar("remoteId", { length: 32 }).notNull(),
    remoteNumber: varchar("remoteNumber", { length: 32 }),
    syncedAt: timestamp("syncedAt").defaultNow().notNull(),
  },
  table => [
    primaryKey({ columns: [table.realmId, table.entityType, table.localId] }),
  ]
);

/** Integration activity log shown to the owner (no tokens or payloads). */
export const syncEvents = mysqlTable(
  "sync_events",
  {
    id: int("id").autoincrement().primaryKey(),
    provider: varchar("provider", { length: 20 }).notNull(),
    action: varchar("action", { length: 40 }).notNull(),
    localId: varchar("localId", { length: 41 }),
    outcome: mysqlEnum("outcome", ["success", "error"]).notNull(),
    message: varchar("message", { length: 500 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("sync_events_created_idx").on(table.createdAt)]
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;
export type LeadStatus = Lead["status"];
export type Customer = typeof customers.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type FollowUp = typeof followUps.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type PaymentRequest = typeof paymentRequests.$inferSelect;
export type IntegrationConnection = typeof integrationConnections.$inferSelect;
