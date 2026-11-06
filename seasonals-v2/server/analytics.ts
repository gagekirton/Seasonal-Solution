/**
 * HANDOFF: First-party, cookieless traffic counts per Winnipeg day.
 * No cookies, no IP storage, no visitor identifiers. Bots are filtered by user agent; counts are directional only.
 */
import type { Express } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { pageViewDaily, sessionSourceDaily } from "../drizzle/schema";
import { isKnownPage, normalizePath } from "../shared/site";
import { BLOG_POST_PATH } from "../shared/content";
import { getDb } from "./db";
import { asyncRoute, createRateLimiter } from "./http";

const BOT_PATTERN =
  /bot|crawl|spider|slurp|preview|headless|lighthouse|pagespeed|facebookexternalhit|embedly|monitor|curl|wget|python|axios|node-fetch|go-http/i;

const SEARCH_ENGINES: Array<[RegExp, string]> = [
  [/(^|\.)google\./, "google"],
  [/(^|\.)bing\.com$/, "bing"],
  [/(^|\.)duckduckgo\.com$/, "duckduckgo"],
  [/(^|\.)search\.yahoo\.com$|(^|\.)yahoo\.com$/, "yahoo"],
  [/(^|\.)ecosia\.org$/, "ecosia"],
  [/(^|\.)yandex\./, "yandex"],
  [/(^|\.)baidu\.com$/, "baidu"],
];
const SOCIAL: Array<[RegExp, string]> = [
  [/(^|\.)facebook\.com$|(^|\.)fb\.com$|^l\.facebook\.com$/, "facebook"],
  [/(^|\.)instagram\.com$/, "instagram"],
  [/^t\.co$|(^|\.)x\.com$|(^|\.)twitter\.com$/, "x"],
  [/(^|\.)linkedin\.com$|^lnkd\.in$/, "linkedin"],
  [/(^|\.)reddit\.com$/, "reddit"],
  [/(^|\.)pinterest\./, "pinterest"],
  [/(^|\.)tiktok\.com$/, "tiktok"],
  [/(^|\.)youtube\.com$|^youtu\.be$/, "youtube"],
  [/(^|\.)nextdoor\./, "nextdoor"],
];

const trackSchema = z
  .object({
    path: z.string().max(300),
    landing: z.boolean().optional().default(false),
    referrer: z.string().max(500).optional().default(""),
    utmSource: z.string().max(120).optional().default(""),
    utmMedium: z.string().max(60).optional().default(""),
  })
  .strict();

/** Calendar day in Winnipeg, formatted YYYY-MM-DD. */
export function winnipegDay(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Winnipeg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function isTrackablePath(raw: string): string | null {
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  const path = normalizePath(raw.split(/[?#]/)[0]).toLowerCase();
  if (path.length > 160) return null;
  if (/^\/(admin|pay|api)(\/|$)/.test(path)) return null;
  if (path === "/404") return null;
  if (BLOG_POST_PATH.test(path) || isKnownPage(path)) return path;
  return null;
}

function cleanLabel(value: string, max: number): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._ -]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, max);
}

/** Classifies a landing visit by UTM tags, then external referrer host. */
export function classifySource(input: {
  referrer: string;
  utmSource: string;
  utmMedium: string;
  ownHost?: string;
}): { source: string; medium: string } {
  const utmSource = cleanLabel(input.utmSource, 100);
  if (utmSource)
    return {
      source: utmSource,
      medium: cleanLabel(input.utmMedium, 40) || "campaign",
    };
  let host = "";
  try {
    host = input.referrer
      ? new URL(input.referrer).hostname.toLowerCase().replace(/^www\./, "")
      : "";
  } catch {
    host = "";
  }
  const ownHost = (input.ownHost ?? "").toLowerCase().replace(/^www\./, "");
  if (!host || host === ownHost) return { source: "direct", medium: "none" };
  for (const [pattern, name] of SEARCH_ENGINES)
    if (pattern.test(host)) return { source: name, medium: "organic" };
  for (const [pattern, name] of SOCIAL)
    if (pattern.test(host)) return { source: name, medium: "social" };
  return { source: host.slice(0, 100), medium: "referral" };
}

const limited = createRateLimiter(60 * 1000, 60);

export function registerAnalyticsRoutes(app: Express) {
  app.post(
    "/api/track",
    asyncRoute(async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      const userAgent = req.get("user-agent") ?? "";
      if (!userAgent || BOT_PATTERN.test(userAgent) || limited(req)) {
        res.status(204).end();
        return;
      }
      let body: unknown = req.body;
      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch {
          body = null;
        }
      }
      const parsed = trackSchema.safeParse(body);
      const path = parsed.success ? isTrackablePath(parsed.data.path) : null;
      if (!parsed.success || !path) {
        res.status(204).end();
        return;
      }
      try {
        const db = await getDb();
        if (!db) throw new Error("Database is not available");
        const day = winnipegDay();
        await db
          .insert(pageViewDaily)
          .values({ day, path, views: 1 })
          .onDuplicateKeyUpdate({
            set: { views: sql`${pageViewDaily.views} + 1` },
          });
        if (parsed.data.landing) {
          const { source, medium } = classifySource({
            ...parsed.data,
            ownHost: req.hostname,
          });
          await db
            .insert(sessionSourceDaily)
            .values({ day, source, medium, sessions: 1 })
            .onDuplicateKeyUpdate({
              set: { sessions: sql`${sessionSourceDaily.sessions} + 1` },
            });
        }
      } catch (error) {
        console.warn(
          "[Stats] Could not record a page view:",
          error instanceof Error ? error.message : "unknown error"
        );
      }
      res.status(204).end();
    })
  );
}
