/**
 * HANDOFF: Stripe HTTP surface. The webhook uses the raw body and verifies the signature.
 * On processing failure it returns 500 (Stripe retries) and alerts the owner once per event.
 * Never mark a payment paid from the browser success redirect.
 */
import express, { type Express } from "express";
import { z } from "zod";
import {
  MIN_PAYMENT_CAD,
  cancelPaymentRequest,
  createCheckoutForToken,
  createPaymentRequest,
  getPublicPaymentRequest,
  getStripe,
  handleStripeEvent,
  listPaymentRequests,
  stripeConfigured,
} from "./stripePayments";
import { alertPaymentReceived, alertWebhookFailure } from "./ownerAlerts";
import { autoPushPayment } from "./quickbooks";
import {
  adminRoute,
  asyncRoute,
  browserOrigin,
  createRateLimiter,
  requireJson,
  setPrivateHeaders,
} from "./http";
import { containsPaymentCredentials } from "./inputSafety";

const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{20,64}$/);
const checkoutLimited = createRateLimiter(10 * 60 * 1000, 20);

const requestSchema = z
  .object({
    jobId: z.string().regex(/^job_[0-9a-f-]{36}$/i),
    amount: z
      .number()
      .finite()
      .min(MIN_PAYMENT_CAD)
      .max(99999.99)
      .refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 1e-7)
      .transform(value => value.toFixed(2)),
    description: z.string().trim().min(3).max(200),
  })
  .strict()
  .refine(value => !containsPaymentCredentials(value.description));

/** Must be registered before any JSON body parser. */
export function registerStripeWebhook(app: Express) {
  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json", limit: "1mb" }),
    asyncRoute(async (req, res) => {
      const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
      const signature = req.get("stripe-signature") ?? "";
      if (!secret || !signature || !Buffer.isBuffer(req.body)) {
        res.status(400).json({ error: "Invalid webhook request." });
        return;
      }
      let event;
      try {
        event = getStripe().webhooks.constructEvent(
          req.body,
          signature,
          secret
        );
      } catch {
        res
          .status(400)
          .json({ error: "Webhook signature verification failed." });
        return;
      }
      try {
        const result = await handleStripeEvent(event);
        res.json({ received: true });
        if (result.fulfilled) {
          const fulfilled = result.fulfilled;
          setImmediate(() => {
            alertPaymentReceived(fulfilled);
            void autoPushPayment(fulfilled.paymentId);
          });
        }
      } catch (error) {
        alertWebhookFailure({ id: event.id, type: event.type });
        console.error(
          "[Stripe] Webhook processing failed:",
          error instanceof Error ? error.message : "unknown error"
        );
        res.status(500).json({ error: "Webhook processing failed." });
      }
    })
  );
}

export function registerStripeRoutes(app: Express) {
  app.get(
    "/api/pay/:token",
    asyncRoute(async (req, res) => {
      setPrivateHeaders(res);
      const token = tokenSchema.safeParse(req.params.token);
      const payment = token.success
        ? await getPublicPaymentRequest(token.data)
        : null;
      if (!payment) {
        res.status(404).json({ error: "This payment link was not found." });
        return;
      }
      res.json({ payment });
    })
  );

  app.post(
    "/api/pay/:token/checkout",
    asyncRoute(async (req, res) => {
      setPrivateHeaders(res);
      if (checkoutLimited(req)) {
        res
          .status(429)
          .json({ error: "Too many attempts. Please try again shortly." });
        return;
      }
      const token = tokenSchema.safeParse(req.params.token);
      const origin = browserOrigin(
        req,
        (req.body as { origin?: unknown })?.origin
      );
      if (!token.success || !origin) {
        res.status(400).json({ error: "Invalid payment request." });
        return;
      }
      if (!stripeConfigured()) {
        res
          .status(503)
          .json({ error: "Online payments are not available right now." });
        return;
      }
      try {
        const result = await createCheckoutForToken(token.data, origin);
        if (result.error) {
          const messages = {
            not_found: [404, "This payment link was not found."],
            not_open: [409, "This payment request is no longer open."],
            processing: [
              409,
              "Your payment is being confirmed. Please wait and refresh this page before trying again.",
            ],
            invalid_amount: [
              400,
              "This payment amount cannot be processed online.",
            ],
          } as const;
          const [status, error] = messages[result.error];
          res.status(status).json({ error });
          return;
        }
        if (!result.url) throw new Error("Stripe returned no checkout URL");
        res.json({ url: result.url });
      } catch (error) {
        console.error(
          "[Stripe] Checkout creation failed:",
          error instanceof Error ? error.message : "unknown error"
        );
        res.status(502).json({
          error: "Secure checkout could not be started. Please try again.",
        });
      }
    })
  );

  app.get(
    "/api/admin/payments",
    adminRoute("list payment requests", async (_req, res) => {
      const key = process.env.STRIPE_SECRET_KEY ?? "";
      res.json({
        stripe: {
          configured: Boolean(key),
          mode: key.startsWith("sk_live") ? "live" : "test",
        },
        requests: await listPaymentRequests(),
      });
    })
  );

  app.post(
    "/api/admin/payments",
    adminRoute("create payment request", async (req, res) => {
      if (!requireJson(req, res)) return;
      const parsed = requestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: `Enter a description and an amount of at least $${MIN_PAYMENT_CAD.toFixed(2)} CAD.`,
        });
        return;
      }
      const result = await createPaymentRequest(parsed.data);
      if ("error" in result) {
        res.status(result.error === "not_found" ? 404 : 409).json({
          error:
            result.error === "not_found"
              ? "Job not found."
              : "Payment requests cannot be created for cancelled jobs.",
        });
        return;
      }
      res.status(201).json({ ...result, path: `/pay/${result.token}` });
    })
  );

  app.post(
    "/api/admin/payments/:id/cancel",
    adminRoute("cancel payment request", async (req, res) => {
      const id = z
        .string()
        .regex(/^preq_[0-9a-f-]{36}$/i)
        .safeParse(req.params.id);
      const outcome = id.success
        ? await cancelPaymentRequest(id.data)
        : "not_found";
      if (outcome === "not_found") {
        res.status(404).json({ error: "Payment request not found." });
        return;
      }
      if (outcome === "not_open") {
        res.status(409).json({ error: "Only open requests can be cancelled." });
        return;
      }
      res.json({ success: true });
    })
  );
}
