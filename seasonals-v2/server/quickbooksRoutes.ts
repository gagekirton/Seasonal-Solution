/**
 * HANDOFF: QuickBooks admin routes and the OAuth callback (callback path: QBO_CALLBACK_PATH).
 * The callback is public by design; it is protected by single-use hashed state stored in oauth_states.
 */
import type { Express } from "express";
import { z } from "zod";
import {
  completeConnect,
  createInvoice,
  disconnect,
  getStatus,
  linksFor,
  listOptions,
  pushPayment,
  startConnect,
  syncCustomer,
  updateSettings,
  QBO_CALLBACK_PATH,
} from "./quickbooks";
import {
  adminRoute,
  asyncRoute,
  browserOrigin,
  requireJson,
  sendPublicError,
} from "./http";

const BASE = "/api/admin/integrations/quickbooks";
const idText = (max: number) => z.string().trim().max(max).nullable().optional().transform(v => v || null);

const settingsSchema = z
  .object({
    defaultItemId: z.string().regex(/^\d{1,32}$/).nullable(),
    defaultItemName: idText(120),
    defaultTaxCodeId: z.string().regex(/^[A-Za-z0-9]{1,32}$/).nullable().optional().transform(v => v ?? null),
    defaultTaxCodeName: idText(120),
    autoSyncPayments: z.boolean(),
  })
  .strict();

const syncSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("customer"), id: z.string().regex(/^cus_[0-9a-f-]{36}$/i) }),
  z.object({ type: z.literal("invoice"), id: z.string().regex(/^job_[0-9a-f-]{36}$/i) }),
  z.object({ type: z.literal("payment"), id: z.string().regex(/^pay_[0-9a-f-]{36}$/i) }),
]);

export function registerQuickbooksRoutes(app: Express) {
  app.get(
    QBO_CALLBACK_PATH,
    asyncRoute(async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      const pick = (key: string) =>
        typeof req.query[key] === "string" ? (req.query[key] as string) : undefined;
      const outcome = await completeConnect({
        state: pick("state"),
        code: pick("code"),
        realmId: pick("realmId"),
        error: pick("error"),
      });
      res.redirect(302, `/admin/integrations?quickbooks=${outcome}`);
    })
  );

  app.get(
    BASE,
    adminRoute("quickbooks status", async (_req, res) => {
      res.json(await getStatus());
    })
  );

  app.post(
    `${BASE}/connect`,
    adminRoute("quickbooks connect", async (req, res, user) => {
      if (!requireJson(req, res)) return;
      const body = req.body as { environment?: unknown; origin?: unknown };
      const environment = z.enum(["sandbox", "production"]).safeParse(body?.environment);
      const origin = browserOrigin(req, body?.origin);
      if (!environment.success || !origin) {
        res.status(400).json({ error: "Choose an environment and try again from the dashboard." });
        return;
      }
      try {
        res.json(await startConnect({ environment: environment.data, origin, adminOpenId: user.openId }));
      } catch (error) {
        if (!sendPublicError(res, error)) throw error;
      }
    })
  );

  app.post(
    `${BASE}/disconnect`,
    adminRoute("quickbooks disconnect", async (_req, res) => {
      await disconnect();
      res.json({ success: true });
    })
  );

  app.get(
    `${BASE}/options`,
    adminRoute("quickbooks options", async (_req, res) => {
      try {
        res.json(await listOptions());
      } catch (error) {
        if (!sendPublicError(res, error)) throw error;
      }
    })
  );

  app.put(
    `${BASE}/settings`,
    adminRoute("quickbooks settings", async (req, res) => {
      if (!requireJson(req, res)) return;
      const parsed = settingsSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid QuickBooks settings." });
        return;
      }
      if (!(await updateSettings(parsed.data))) {
        res.status(409).json({ error: "QuickBooks is not connected." });
        return;
      }
      res.json({ success: true });
    })
  );

  app.post(
    `${BASE}/sync`,
    adminRoute("quickbooks sync", async (req, res) => {
      if (!requireJson(req, res)) return;
      const parsed = syncSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid sync request." });
        return;
      }
      try {
        const { type, id } = parsed.data;
        const link =
          type === "customer"
            ? await syncCustomer(id)
            : type === "invoice"
              ? await createInvoice(id)
              : await pushPayment(id);
        res.json({ link });
      } catch (error) {
        if (!sendPublicError(res, error)) throw error;
      }
    })
  );

  app.post(
    `${BASE}/links`,
    adminRoute("quickbooks links", async (req, res) => {
      if (!requireJson(req, res)) return;
      const parsed = z
        .object({ ids: z.array(z.string().max(41)).max(300) })
        .strict()
        .safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid request." });
        return;
      }
      res.json({ links: await linksFor(parsed.data.ids) });
    })
  );
}
