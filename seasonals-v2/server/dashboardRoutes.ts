/**
 * HANDOFF: Admin dashboard endpoints: /dashboard, /alerts, /logout, /leads(.csv), /me.
 * All go through adminRoute. Lead CSV export formula-escapes cells; keep that.
 */
import type { Express } from "express";
import { z } from "zod";
import { SERVICES } from "../shared/site";
import {
  DASHBOARD_RANGES,
  LEAD_STATUSES,
  getAlertCounts,
  getDashboard,
  searchLeads,
  updateLead,
} from "./dashboardDb";
import { COOKIE_NAME } from "../shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { adminRoute, requireJson } from "./http";
import { containsPaymentCredentials } from "./inputSafety";

function csvCell(value: unknown): string {
  const text =
    value instanceof Date ? value.toISOString() : String(value ?? "");
  const safeText = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

const listQuery = z.object({
  q: z.string().max(100).optional(),
  status: z.enum(LEAD_STATUSES).optional(),
  service: z
    .string()
    .optional()
    .refine(
      value => !value || SERVICES.some(service => service.slug === value)
    ),
});

const leadPatch = z
  .object({
    status: z.enum(LEAD_STATUSES).optional(),
    internalNote: z
      .string()
      .trim()
      .max(1000)
      .nullable()
      .optional()
      .transform(value => (value === undefined ? undefined : value || null)),
  })
  .strict()
  .refine(
    value => value.status !== undefined || value.internalNote !== undefined
  )
  .refine(value => !containsPaymentCredentials(value.internalNote ?? ""));

export function registerDashboardRoutes(app: Express) {
  app.get(
    "/api/admin/me",
    adminRoute("identify admin", async (_req, res, user) => {
      res.json({ name: user.name ?? "Owner", email: user.email ?? null });
    })
  );

  app.post(
    "/api/admin/logout",
    adminRoute("logout", async (req, res) => {
      res.clearCookie(COOKIE_NAME, {
        ...getSessionCookieOptions(req),
        maxAge: -1,
      });
      res.json({ ok: true });
    })
  );

  app.get(
    "/api/admin/alerts",
    adminRoute("dashboard alerts", async (_req, res) => {
      res.json(await getAlertCounts());
    })
  );

  app.get(
    "/api/admin/dashboard",
    adminRoute("dashboard", async (req, res) => {
      const requested = Number(req.query.range ?? 30);
      const range = (DASHBOARD_RANGES as readonly number[]).includes(requested)
        ? requested
        : 30;
      res.json(await getDashboard(range));
    })
  );

  app.get(
    "/api/admin/leads",
    adminRoute("list leads", async (req, res) => {
      const parsed = listQuery.safeParse({
        q: typeof req.query.q === "string" ? req.query.q : undefined,
        status:
          typeof req.query.status === "string" && req.query.status
            ? req.query.status
            : undefined,
        service:
          typeof req.query.service === "string" && req.query.service
            ? req.query.service
            : undefined,
      });
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid lead filters." });
        return;
      }
      const result = await searchLeads({ ...parsed.data, limit: 200 });
      res.json({
        statusCounts: result.statusCounts,
        leads: result.leads.map(lead => ({
          ...lead,
          createdAt: lead.createdAt.toISOString(),
          consentAt: lead.consentAt.toISOString(),
          statusChangedAt: lead.statusChangedAt?.toISOString() ?? null,
        })),
      });
    })
  );

  app.patch(
    "/api/admin/leads/:id",
    adminRoute("update lead", async (req, res) => {
      if (!requireJson(req, res)) return;
      const id = Number(req.params.id);
      const parsed = leadPatch.safeParse(req.body);
      if (!Number.isSafeInteger(id) || id < 1 || !parsed.success) {
        res.status(400).json({ error: "Invalid lead update." });
        return;
      }
      if (!(await updateLead(id, parsed.data))) {
        res.status(404).json({ error: "Lead not found." });
        return;
      }
      res.json({ success: true });
    })
  );

  app.get(
    "/api/admin/leads.csv",
    adminRoute("export leads", async (_req, res) => {
      const { leads } = await searchLeads({ limit: 500 });
      const columns = [
        "id",
        "customerId",
        "createdAt",
        "status",
        "name",
        "email",
        "phone",
        "service",
        "area",
        "projectType",
        "details",
        "internalNote",
        "consentAt",
        "sourcePath",
        "landingPath",
        "utmSource",
        "utmMedium",
        "utmCampaign",
      ] as const;
      const rows = leads.map(record =>
        columns.map(column => csvCell(record[column])).join(",")
      );
      res.set({
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          "attachment; filename=seasonal-solutions-leads.csv",
      });
      res
        .status(200)
        .send(`\uFEFF${[columns.join(","), ...rows].join("\r\n")}`);
    })
  );
}
