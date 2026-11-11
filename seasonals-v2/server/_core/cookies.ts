import type { CookieOptions, Request } from "express";

export function getSessionCookieOptions(req: Request): CookieOptions {
  // Behind a TLS-terminating proxy (the production hosts) the original scheme
  // arrives in X-Forwarded-Proto; fall back to the socket protocol locally.
  const forwarded = req.headers["x-forwarded-proto"];
  const proto =
    (Array.isArray(forwarded) ? forwarded[0] : forwarded)
      ?.split(",")[0]
      ?.trim() || req.protocol;
  const secure = proto === "https";
  // First-party admin on the site's own origin: Lax is the right default.
  return { httpOnly: true, path: "/", sameSite: "lax", secure };
}
