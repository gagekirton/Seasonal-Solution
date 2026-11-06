/**
 * HANDOFF: Shared route helpers.
 * - `adminRoute` is the ONLY approved gate for /api/admin/*. Every admin endpoint must use it.
 * - `browserOrigin` trusts any HTTPS Origin sent by the browser (NEXT-TASKS T3).
 * - `asyncRoute`, `createRateLimiter` and `requireJson` are also duplicated elsewhere (NEXT-TASKS T8).
 */
import type { Request, RequestHandler, Response } from "express";
import {
  adminDeniedStatus,
  requireCrmAdministrator,
} from "./_core/adminAccess";

export type AdminUser = NonNullable<
  Awaited<ReturnType<typeof requireCrmAdministrator>>
>;

export function asyncRoute(
  handler: (req: Request, res: Response) => Promise<void>
): RequestHandler {
  return (req, res, next) => {
    void handler(req, res).catch(next);
  };
}

export function setPrivateHeaders(res: Response) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
}

/** Wraps an owner/admin-only handler with authorization and safe errors. */
export function adminRoute(
  name: string,
  handler: (req: Request, res: Response, user: AdminUser) => Promise<void>
): RequestHandler {
  return asyncRoute(async (req, res) => {
    setPrivateHeaders(res);
    const user = await requireCrmAdministrator(req);
    if (!user) {
      res
        .status(adminDeniedStatus(req))
        .json({ error: "Administrative access required." });
      return;
    }
    try {
      await handler(req, res, user);
    } catch (error) {
      console.error(
        `[Admin] ${name} failed:`,
        error instanceof Error ? error.message : "unknown error"
      );
      if (!res.headersSent)
        res.status(error instanceof PublicError ? error.status : 503).json({
          error:
            error instanceof PublicError
              ? error.message
              : "This dashboard service is temporarily unavailable.",
        });
    }
  });
}

/** An error whose message is safe to show to the signed-in owner. */
export class PublicError extends Error {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message);
  }
}

export function sendPublicError(res: Response, error: unknown): boolean {
  if (error instanceof PublicError) {
    res.status(error.status).json({ error: error.message });
    return true;
  }
  return false;
}

export function requireJson(req: Request, res: Response): boolean {
  if (req.is("application/json")) return true;
  res.status(415).json({ error: "This action requires a JSON request." });
  return false;
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

/**
 * Returns the browser-visible origin for building redirect URLs. The claimed
 * origin must match the request's Origin header, which browsers set on POST.
 */
export function browserOrigin(req: Request, claimed: unknown): string | null {
  if (typeof claimed !== "string" || claimed.length > 200) return null;
  const header = req.get("origin");
  if (!header || header !== claimed) return null;
  try {
    const url = new URL(claimed);
    if (url.origin !== claimed) return null;
    if (url.protocol === "https:") return url.origin;
    if (url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname))
      return url.origin;
    return null;
  } catch {
    return null;
  }
}

type WindowState = { startedAt: number; count: number };

/** Small in-memory fixed-window limiter; keys are never persisted. */
export function createRateLimiter(windowMs: number, max: number) {
  const windows = new Map<string, WindowState>();
  return (req: Request): boolean => {
    const key = (req.ip || "unknown").slice(0, 80);
    const now = Date.now();
    const current = windows.get(key);
    if (!current || now - current.startedAt > windowMs) {
      windows.set(key, { startedAt: now, count: 1 });
      if (windows.size > 5000)
        for (const [oldKey, state] of windows)
          if (now - state.startedAt > windowMs) windows.delete(oldKey);
      return false;
    }
    current.count += 1;
    return current.count > max;
  };
}
