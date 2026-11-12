import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { hashPassword, verifyPassword } from "./password";
import { sdk } from "./sdk";

/**
 * Owner sign-in (replaced the Manus OAuth routes in the 2026-11-11 rebuild).
 *
 * POST /api/auth/login { email, password } verifies the password against the
 * users table (scrypt hash in users.passwordHash) and issues the same signed
 * session cookie the rest of the app already understands.
 *
 * First-run bootstrap: when OWNER_EMAIL and OWNER_PASSWORD are set and no
 * password is stored yet for that email, a matching sign-in creates (or
 * claims) the owner account and stores the hash. A second approved sign-in
 * works the same way via ADMIN_EMAIL and ADMIN_PASSWORD (an admin account
 * for maintenance and assistance). After that the database hash is the
 * credential — the environment passwords can be removed, and a password can
 * be rotated by updating the hash.
 */

const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX_FAILURES = 10;
const failures = new Map<string, { startedAt: number; count: number }>();

function clientKey(req: Request): string {
  return (req.ip || "unknown").slice(0, 80);
}

function isRateLimited(req: Request): boolean {
  const entry = failures.get(clientKey(req));
  if (!entry) return false;
  if (Date.now() - entry.startedAt > RATE_WINDOW_MS) {
    failures.delete(clientKey(req));
    return false;
  }
  return entry.count >= RATE_MAX_FAILURES;
}

function noteFailure(req: Request): void {
  const key = clientKey(req);
  const entry = failures.get(key);
  if (!entry || Date.now() - entry.startedAt > RATE_WINDOW_MS) {
    failures.set(key, { startedAt: Date.now(), count: 1 });
  } else {
    entry.count += 1;
  }
  if (failures.size > 5000) {
    const now = Date.now();
    for (const [oldKey, state] of failures) {
      if (now - state.startedAt > RATE_WINDOW_MS) failures.delete(oldKey);
    }
  }
}

type BootstrapIdentity = { email: string; openId: string; name: string };

function matchBootstrap(email: string, password: string): BootstrapIdentity | null {
  const lower = email.toLowerCase();
  if (
    ENV.ownerEmail.length > 0 &&
    ENV.ownerPassword.length > 0 &&
    lower === ENV.ownerEmail.toLowerCase() &&
    password === ENV.ownerPassword
  ) {
    return { email: ENV.ownerEmail, openId: "owner", name: "Owner" };
  }
  if (
    ENV.adminEmail.length > 0 &&
    ENV.adminPassword.length > 0 &&
    lower === ENV.adminEmail.toLowerCase() &&
    password === ENV.adminPassword
  ) {
    return { email: ENV.adminEmail, openId: `admin:${lower}`, name: "Admin" };
  }
  return null;
}

export function registerAuthRoutes(app: Express) {
  app.post(
    "/api/auth/login",
    async (req: Request, res: Response): Promise<void> => {
      res.setHeader("Cache-Control", "private, no-store");
      try {
        if (isRateLimited(req)) {
          res
            .status(429)
            .json({ error: "Too many sign-in attempts. Try again later." });
          return;
        }

        const body =
          req.body && typeof req.body === "object"
            ? (req.body as Record<string, unknown>)
            : {};
        const email =
          typeof body.email === "string" ? body.email.trim() : "";
        const password =
          typeof body.password === "string" ? body.password : "";
        if (!email || email.length > 320 || !password || password.length > 200) {
          res.status(400).json({ error: "Email and password are required." });
          return;
        }

        let user = await db.getUserByEmail(email);

        // First-run bootstrap / account claim: no stored password yet and the
        // attempt matches one of the configured approved sign-ins.
        const bootstrap =
          !user || !user.passwordHash ? matchBootstrap(email, password) : null;
        if (bootstrap) {
          if (!user) {
            await db.upsertUser({
              openId: bootstrap.openId,
              name: bootstrap.name,
              email: bootstrap.email,
              loginMethod: "password",
              role: "admin",
              lastSignedIn: new Date(),
            });
            user = await db.getUserByOpenId(bootstrap.openId);
          }
          if (user && !user.passwordHash) {
            await db.setUserPasswordHash(user.openId, await hashPassword(password));
            user = await db.getUserByOpenId(user.openId);
          }
        }

        const passwordOk = user
          ? await verifyPassword(password, user.passwordHash)
          : false;
        if (!user || !passwordOk) {
          noteFailure(req);
          res.status(401).json({ error: "Email or password is incorrect." });
          return;
        }

        if (user.role !== "admin" && user.openId !== ENV.ownerOpenId) {
          res
            .status(403)
            .json({ error: "This account does not have dashboard access." });
          return;
        }

        failures.delete(clientKey(req));
        await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });

        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name || "",
          expiresInMs: ONE_YEAR_MS,
        });
        res.cookie(COOKIE_NAME, sessionToken, {
          ...getSessionCookieOptions(req),
          maxAge: ONE_YEAR_MS,
        });
        res.json({ ok: true });
      } catch (error) {
        console.error(
          "[Auth] Sign-in failed:",
          error instanceof Error ? error.message : "unknown error"
        );
        res.status(500).json({ error: "Sign-in could not be completed." });
      }
    }
  );
}
