/**
 * HANDOFF: sitemap.xml: public indexable paths plus published posts. Admin and /pay pages must never appear.
 * /blog and /our-work are thin until they have content (NEXT-TASKS T2).
 */
import type { Express } from "express";
import { INDEXABLE_PATHS, SITE_ORIGIN } from "../shared/site";
import { listPublishedSlugs } from "./contentDb";

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function buildSitemap(): Promise<string> {
  let posts: Array<{ slug: string; updatedAt: Date }> = [];
  try {
    posts = await listPublishedSlugs();
  } catch (error) {
    console.error(
      "[Sitemap] Could not load posts:",
      error instanceof Error ? error.message : "unknown error"
    );
  }
  const urls = [
    ...INDEXABLE_PATHS.map(path => ({
      loc: `${SITE_ORIGIN}${path}`,
      lastmod: null as string | null,
    })),
    ...posts.map(post => ({
      loc: `${SITE_ORIGIN}/blog/${post.slug}`,
      lastmod: post.updatedAt.toISOString().slice(0, 10),
    })),
  ];
  const body = urls
    .map(
      url =>
        `  <url><loc>${escapeXml(url.loc)}</loc>${url.lastmod ? `<lastmod>${url.lastmod}</lastmod>` : ""}</url>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function registerSitemapRoute(app: Express) {
  app.get("/sitemap.xml", (_req, res, next) => {
    void buildSitemap()
      .then(xml => {
        res
          .status(200)
          .set({
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=300",
          })
          .send(xml);
      })
      .catch(next);
  });
}
