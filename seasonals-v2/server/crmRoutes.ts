/**
 * HANDOFF: Admin CRM endpoints. Each uses a private-route wrapper that enforces owner/admin access.
 * Keep responses no-store. Customer CSV export formula-escapes cells; keep that.
 */
import type { Express, Request, RequestHandler, Response } from "express";
import { z } from "zod";
import { SERVICES } from "../shared/site";
import { containsPaymentCredentials } from "./inputSafety";
import { autoPushPayment } from "./quickbooks";
import {
  createCrmFollowUp,
  createCrmJob,
  getCrmCustomer,
  getCrmOverview,
  listCrmCustomers,
  listCrmFollowUps,
  recordJobPayment,
  recordMarketingOptOut,
  updateCrmCustomer,
  updateCrmFollowUp,
  updateCrmJob,
} from "./crmDb";
import {
  adminDeniedStatus,
  requireCrmAdministrator,
} from "./_core/adminAccess";

function asyncRoute(
  handler: (req: Request, res: Response) => Promise<void>
): RequestHandler {
  return (req, res, next) => {
    void handler(req, res).catch(next);
  };
}

function privateRoute(
  name: string,
  handler: (req: Request, res: Response) => Promise<void>
): RequestHandler {
  return asyncRoute(async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const user = await requireCrmAdministrator(req);
    if (!user) {
      res
        .status(adminDeniedStatus(req))
        .json({ error: "Administrative access required." });
      return;
    }
    try {
      await handler(req, res);
    } catch (error) {
      console.error(
        `[CRM] ${name} failed:`,
        error instanceof Error ? error.message : "unknown error"
      );
      if (!res.headersSent)
        res
          .status(503)
          .json({ error: "The CRM service is temporarily unavailable." });
    }
  });
}

function requireJson(req: Request, res: Response): boolean {
  if (req.is("application/json")) return true;
  res.status(415).json({ error: "This action requires a JSON request." });
  return false;
}

const customerIdSchema = z.string().regex(/^cus_[0-9a-f-]{36}$/i);
const jobIdSchema = z.string().regex(/^job_[0-9a-f-]{36}$/i);
const taskIdSchema = z.string().regex(/^task_[0-9a-f-]{36}$/i);
const statusList = [
  "quoted",
  "booked",
  "in_progress",
  "completed",
  "cancelled",
] as const;
const serviceSchema = z
  .string()
  .trim()
  .refine(
    value => SERVICES.some(service => service.slug === value),
    "Unknown service"
  );
const amountSchema = z
  .number()
  .finite()
  .min(0)
  .max(9999999.99)
  .refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 1e-7)
  .transform(value => value.toFixed(2));
const nullableAmountSchema = amountSchema
  .nullable()
  .optional()
  .transform(value => value ?? null);

const customerPatchSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    phone: z.string().trim().max(40).nullable().optional(),
    serviceArea: z.string().trim().max(120).nullable().optional(),
  })
  .strict()
  .refine(value => !containsPaymentCredentials(value))
  .refine(value => Object.keys(value).length > 0);

const jobCreateSchema = z
  .object({
    customerId: customerIdSchema,
    leadId: z
      .number()
      .int()
      .positive()
      .nullable()
      .optional()
      .transform(value => value ?? null),
    service: serviceSchema,
    summary: z.string().trim().min(2).max(2000),
    quotedAmount: nullableAmountSchema,
    bookedAmount: nullableAmountSchema,
    status: z.enum(statusList).default("quoted"),
    scheduledAt: z
      .string()
      .datetime()
      .nullable()
      .optional()
      .transform(value => (value ? new Date(value) : null)),
  })
  .strict()
  .refine(value => !containsPaymentCredentials(value))
  .refine(
    value => value.status !== "quoted" || value.bookedAmount === null,
    "Accepted amounts require an accepted job status."
  );

const jobPatchSchema = z
  .object({
    status: z.enum(statusList).optional(),
    quotedAmount: amountSchema.nullable().optional(),
    bookedAmount: amountSchema.nullable().optional(),
    scheduledAt: z
      .string()
      .datetime()
      .nullable()
      .optional()
      .transform((value): Date | null | undefined =>
        value == null ? value : new Date(value)
      ),
  })
  .strict()
  .refine(
    value =>
      value.bookedAmount == null ||
      (value.status !== undefined &&
        ["booked", "in_progress", "completed"].includes(value.status)),
    "Choose an accepted status when setting a booked amount."
  )
  .refine(value => Object.keys(value).length > 0);

const paymentSchema = z
  .object({
    kind: z.enum(["payment", "refund"]),
    source: z.enum(["manual", "stripe"]).optional(),
    amount: amountSchema.refine(value => Number(value) > 0),
    reference: z
      .string()
      .trim()
      .max(120)
      .nullable()
      .optional()
      .transform(value => value || null),
    note: z
      .string()
      .trim()
      .max(1000)
      .nullable()
      .optional()
      .transform(value => value || null),
  })
  .strict()
  .refine(value => !containsPaymentCredentials(value));

const followUpCreateSchema = z
  .object({
    customerId: customerIdSchema,
    leadId: z
      .number()
      .int()
      .positive()
      .nullable()
      .optional()
      .transform(value => value ?? null),
    jobId: jobIdSchema
      .nullable()
      .optional()
      .transform(value => value ?? null),
    type: z.enum(["quote", "service", "seasonal"]),
    title: z.string().trim().min(2).max(140),
    note: z
      .string()
      .trim()
      .max(1000)
      .nullable()
      .optional()
      .transform(value => value || null),
    dueAt: z
      .string()
      .datetime()
      .transform(value => new Date(value)),
  })
  .strict()
  .refine(value => !containsPaymentCredentials(value));

function csvCell(value: unknown): string {
  const text =
    value instanceof Date ? value.toISOString() : String(value ?? "");
  const safeText = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

export function registerCrmRoutes(app: Express) {
  app.get(
    "/api/admin/crm/overview",
    privateRoute("overview", async (_req, res) => {
      res.json({ overview: await getCrmOverview() });
    })
  );

  app.get(
    "/api/admin/crm/customers",
    privateRoute("customers", async (req, res) => {
      const search =
        typeof req.query.search === "string" ? req.query.search : "";
      const [customers, overview] = await Promise.all([
        listCrmCustomers(search, 200),
        getCrmOverview(),
      ]);
      res.json({ customers, overview });
    })
  );

  app.get(
    "/api/admin/crm/customers.csv",
    privateRoute("customer export", async (_req, res) => {
      const records = await listCrmCustomers("", 500);
      const columns = [
        "id",
        "name",
        "email",
        "phone",
        "serviceArea",
        "firstContactAt",
        "lastContactAt",
        "jobCount",
        "completedJobCount",
        "bookedValue",
        "collectedValue",
        "marketingConsentAt",
        "marketingOptOutAt",
      ] as const;
      const rows = records.map(record =>
        columns.map(column => csvCell(record[column])).join(",")
      );
      res.set({
        "Cache-Control": "private, no-store",
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          "attachment; filename=seasonal-solutions-customers.csv",
        "X-Content-Type-Options": "nosniff",
      });
      res
        .status(200)
        .send(`\uFEFF${[columns.join(","), ...rows].join("\r\n")}`);
    })
  );

  app.get(
    "/api/admin/crm/customers/:customerId",
    privateRoute("customer profile", async (req, res) => {
      const parsedId = customerIdSchema.safeParse(req.params.customerId);
      if (!parsedId.success) {
        res.status(400).json({ error: "Invalid customer ID." });
        return;
      }
      const profile = await getCrmCustomer(parsedId.data);
      if (!profile) {
        res.status(404).json({ error: "Customer not found." });
        return;
      }
      res.json({ profile });
    })
  );

  app.patch(
    "/api/admin/crm/customers/:customerId",
    privateRoute("customer update", async (req, res) => {
      if (!requireJson(req, res)) return;
      const parsedId = customerIdSchema.safeParse(req.params.customerId);
      const parsed = customerPatchSchema.safeParse(req.body);
      if (!parsedId.success || !parsed.success) {
        res.status(400).json({ error: "Invalid customer details." });
        return;
      }
      const updated = await updateCrmCustomer(parsedId.data, parsed.data);
      res.status(updated ? 200 : 404).json({ success: updated });
    })
  );

  app.post(
    "/api/admin/crm/customers/:customerId/marketing-opt-out",
    privateRoute("marketing opt-out", async (req, res) => {
      if (!requireJson(req, res)) return;
      const parsedId = customerIdSchema.safeParse(req.params.customerId);
      if (!parsedId.success) {
        res.status(400).json({ error: "Invalid customer ID." });
        return;
      }
      const exists = await recordMarketingOptOut(parsedId.data);
      res.status(exists ? 200 : 404).json({ success: exists });
    })
  );

  app.post(
    "/api/admin/crm/jobs",
    privateRoute("job creation", async (req, res) => {
      if (!requireJson(req, res)) return;
      const parsed = jobCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: "Check the customer, service and job details." });
        return;
      }
      const id = await createCrmJob(parsed.data);
      if (!id) {
        res
          .status(400)
          .json({ error: "The selected customer or inquiry was not found." });
        return;
      }
      res.status(201).json({ success: true, id });
    })
  );

  app.patch(
    "/api/admin/crm/jobs/:jobId",
    privateRoute("job update", async (req, res) => {
      if (!requireJson(req, res)) return;
      const parsedId = jobIdSchema.safeParse(req.params.jobId);
      const parsed = jobPatchSchema.safeParse(req.body);
      if (!parsedId.success || !parsed.success) {
        res.status(400).json({ error: "Invalid job update." });
        return;
      }
      const updated = await updateCrmJob(parsedId.data, parsed.data);
      res.status(updated ? 200 : 404).json({ success: updated });
    })
  );

  app.post(
    "/api/admin/crm/jobs/:jobId/payments",
    privateRoute("payment entry", async (req, res) => {
      if (!requireJson(req, res)) return;
      const parsedId = jobIdSchema.safeParse(req.params.jobId);
      const parsed = paymentSchema.safeParse(req.body);
      if (!parsedId.success || !parsed.success) {
        res.status(400).json({ error: "Enter a valid positive CAD amount." });
        return;
      }
      const result = await recordJobPayment({
        jobId: parsedId.data,
        ...parsed.data,
      });
      if ("error" in result && result.error === "not_found") {
        res.status(404).json({ error: "Job not found." });
        return;
      }
      if ("error" in result && result.error === "refund_exceeds_balance") {
        res.status(409).json({
          error:
            "A refund cannot exceed the recorded net payments for this job and payment channel.",
        });
        return;
      }
      res.status(201).json({ success: true, id: result.id });
      if (parsed.data.kind === "payment")
        setImmediate(() => void autoPushPayment(result.id));
    })
  );

  app.get(
    "/api/admin/crm/follow-ups",
    privateRoute("follow-up list", async (req, res) => {
      const requested =
        typeof req.query.status === "string" ? req.query.status : "open";
      const parsed = z
        .enum(["open", "overdue", "completed", "cancelled", "all"])
        .safeParse(requested);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid follow-up status filter." });
        return;
      }
      res.json({ followUps: await listCrmFollowUps(parsed.data) });
    })
  );

  app.post(
    "/api/admin/crm/follow-ups",
    privateRoute("follow-up creation", async (req, res) => {
      if (!requireJson(req, res)) return;
      const parsed = followUpCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: "Check the follow-up details and due date." });
        return;
      }
      const result = await createCrmFollowUp(parsed.data);
      if (!result) {
        res
          .status(400)
          .json({ error: "The selected customer, lead or job was not found." });
        return;
      }
      if ("consentRequired" in result) {
        res.status(409).json({
          error:
            "Seasonal or promotional follow-up requires a current recorded email opt-in.",
        });
        return;
      }
      res.status(201).json({ success: true, id: result.id });
    })
  );

  app.patch(
    "/api/admin/crm/follow-ups/:taskId",
    privateRoute("follow-up status", async (req, res) => {
      if (!requireJson(req, res)) return;
      const parsedId = taskIdSchema.safeParse(req.params.taskId);
      const parsed = z
        .object({ status: z.enum(["open", "completed", "cancelled"]) })
        .strict()
        .safeParse(req.body);
      if (!parsedId.success || !parsed.success) {
        res.status(400).json({ error: "Invalid follow-up update." });
        return;
      }
      const updated = await updateCrmFollowUp(
        parsedId.data,
        parsed.data.status
      );
      if (typeof updated === "object") {
        res.status(409).json({
          error:
            "A seasonal task cannot be reopened without a current recorded email opt-in.",
        });
        return;
      }
      res.status(updated ? 200 : 404).json({ success: updated });
    })
  );
}
