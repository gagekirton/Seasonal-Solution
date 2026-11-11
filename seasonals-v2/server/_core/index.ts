/**
 * HANDOFF: Composition root: middleware order matters.
 * 1. `registerStripeWebhook` MUST stay before `express.json()` (signature check needs the raw body).
 * 2. `/api/admin` has a cross-site guard (Sec-Fetch-Site); it fails open if the header is absent (NEXT-TASKS T4).
 * 3. `/api/quote` is still inline here; move to server/quoteRoutes.ts (NEXT-TASKS T8).
 * 4. Rate limits are in-memory by req.ip and are never persisted. Do not store IP addresses.
 */
import "dotenv/config";
import express, {
  type Request,
  type RequestHandler,
  type Response,
} from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerAuthRoutes } from "./auth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import compression from "compression";
import { createLeadWithCustomer } from "../crmDb";
import { registerCrmRoutes } from "../crmRoutes";
import { registerAnalyticsRoutes } from "../analytics";
import { registerContentRoutes } from "../contentRoutes";
import { registerDashboardRoutes } from "../dashboardRoutes";
import { registerStripeRoutes, registerStripeWebhook } from "../stripeRoutes";
import { registerQuickbooksRoutes } from "../quickbooksRoutes";
import { registerSitemapRoute } from "../sitemap";
import { alertNewLead } from "../ownerAlerts";
import { SERVICES } from "../../shared/site";
import { z } from "zod";
import { containsPaymentCredentials } from "../inputSafety";

const quoteSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(320),
    phone: z.string().trim().max(40).optional().default(""),
    service: z.enum(
      SERVICES.map(service => service.slug) as [string, ...string[]]
    ),
    area: z.string().trim().max(120).optional().default(""),
    projectType: z.enum(["residential", "commercial"]),
    details: z.string().trim().min(10).max(5000),
    consent: z.literal(true),
    marketingOptIn: z.boolean().optional().default(false),
    landingPath: z
      .string()
      .trim()
      .max(255)
      .refine(
        value =>
          value === "" ||
          (value.startsWith("/") &&
            !value.startsWith("//") &&
            !/[?#\u0000-\u001f]/.test(value))
      )
      .optional()
      .default(""),
    utmSource: z.string().trim().max(120).optional().default(""),
    utmMedium: z.string().trim().max(120).optional().default(""),
    utmCampaign: z.string().trim().max(160).optional().default(""),
    website: z.string().max(300).optional().default(""),
  })
  .strict()
  .refine(
    value => !containsPaymentCredentials(value),
    "Do not include payment credentials."
  );

type WindowState = { startedAt: number; count: number };
const rateWindows = new Map<string, WindowState>();
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 8;

function asyncRoute(
  handler: (req: Request, res: Response) => Promise<void>
): RequestHandler {
  return (req, res, next) => {
    void handler(req, res).catch(next);
  };
}

function clientKey(req: Request): string {
  return (req.ip || "unknown").slice(0, 80);
}

function isRateLimited(req: Request): boolean {
  const now = Date.now();
  const key = clientKey(req);
  const current = rateWindows.get(key);
  if (!current || now - current.startedAt > RATE_WINDOW_MS) {
    rateWindows.set(key, { startedAt: now, count: 1 });
    if (rateWindows.size > 5000) {
      for (const [oldKey, state] of rateWindows) {
        if (now - state.startedAt > RATE_WINDOW_MS) rateWindows.delete(oldKey);
      }
    }
    return false;
  }
  current.count += 1;
  return current.count > RATE_MAX;
}

function setPrivateResponse(res: Response) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(compression());
  app.use((_req, res, next) => {
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=(self)"
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
  });
  // Stripe signs the raw body, so its webhook must precede JSON parsing.
  // HANDOFF: Must stay BEFORE express.json(): Stripe signature verification needs the raw request body.
  registerStripeWebhook(app);
  app.use(express.json({ limit: "100kb" }));
  app.use(express.urlencoded({ limit: "16kb", extended: false }));
  // Preview sessions use SameSite=None cookies. A malicious external page
  // must not be able to submit a simple POST using those ambient cookies.
  app.use("/api/admin", (req, res, next) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.get("sec-fetch-site") === "cross-site"
    ) {
      res.set("Cache-Control", "private, no-store");
      res
        .status(403)
        .json({ error: "Cross-site dashboard actions are not allowed." });
      return;
    }
    next();
  });
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

  // HANDOFF: Public quote endpoint. Order is deliberate: honeypot (silent 202), then rate limit, validation and the
  // HANDOFF: payment-card detector. Do not store the client IP.
  app.post(
    "/api/quote",
    asyncRoute(async (req, res) => {
      setPrivateResponse(res);
      const incoming =
        req.body && typeof req.body === "object"
          ? (req.body as Record<string, unknown>)
          : {};
      if (
        typeof incoming.website === "string" &&
        incoming.website.trim().length > 0
      ) {
        res.status(202).json({ success: true });
        return;
      }
      if (isRateLimited(req)) {
        res.status(429).json({
          error:
            "Too many requests. Please try again later or call Seasonal Solutions directly.",
        });
        return;
      }
      const parsed = quoteSchema.safeParse(incoming);
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: "Please check the required fields and try again." });
        return;
      }
      const sourcePath = (() => {
        try {
          const referrer = req.get("referer");
          const path = referrer
            ? new URL(referrer).pathname.slice(0, 255)
            : null;
          return containsPaymentCredentials(path) ? null : path;
        } catch {
          return null;
        }
      })();
      try {
        await createLeadWithCustomer(
          {
            name: parsed.data.name,
            email: parsed.data.email,
            phone: parsed.data.phone || null,
            service: parsed.data.service,
            area: parsed.data.area || null,
            projectType: parsed.data.projectType,
            details: parsed.data.details,
            consentAt: new Date(),
            sourcePath,
            landingPath: parsed.data.landingPath || null,
            utmSource: parsed.data.utmSource || null,
            utmMedium: parsed.data.utmMedium || null,
            utmCampaign: parsed.data.utmCampaign || null,
            status: "new",
          },
          parsed.data.marketingOptIn
        );
        res.status(201).json({ success: true });
        alertNewLead({
          name: parsed.data.name,
          email: parsed.data.email,
          phone: parsed.data.phone || null,
          service: parsed.data.service,
          area: parsed.data.area || null,
          projectType: parsed.data.projectType,
          details: parsed.data.details,
        });
      } catch (error) {
        console.error(
          "[Quote] Could not save a quote request:",
          error instanceof Error ? error.message : "unknown error"
        );
        res.status(503).json({
          error:
            "The request could not be saved right now. Please call or email Seasonal Solutions instead.",
        });
      }
    })
  );

  registerSitemapRoute(app);
  registerAnalyticsRoutes(app);
  registerDashboardRoutes(app);
  registerContentRoutes(app);
  registerStripeRoutes(app);
  registerQuickbooksRoutes(app);
  registerCrmRoutes(app);
  registerAuthRoutes(app);
  registerStorageProxy(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({ router: appRouter, createContext })
  );

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  app.use(
    (
      error: unknown,
      req: Request,
      res: Response,
      _next: (error?: unknown) => void
    ) => {
      console.error(
        "[HTTP] Request failed:",
        error instanceof Error ? error.message : "unknown error"
      );
      if (!res.headersSent) {
        if (req.path.startsWith("/api/")) {
          const details =
            error && typeof error === "object"
              ? (error as { status?: number; type?: string })
              : {};
          const status =
            details.status === 413
              ? 413
              : details.status === 400 || details.type === "entity.parse.failed"
                ? 400
                : 500;
          const message =
            status === 413
              ? "Request body too large."
              : status === 400
                ? "Invalid request body."
                : "The request could not be completed.";
          res.status(status).json({ error: message });
        } else
          res
            .status(500)
            .type("text/plain")
            .send("The page could not be rendered.");
      }
    }
  );

  const port = Number(process.env.PORT || "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid PORT");
  server.on("error", error => {
    console.error("Server failed:", error.message);
    process.exit(1);
  });
  server.listen(port, "0.0.0.0", () =>
    console.log(`Server listening on port ${port}`)
  );
}

startServer().catch(error => {
  console.error(error);
  process.exit(1);
});
