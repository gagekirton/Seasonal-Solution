import express from "express";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PostDetail } from "../shared/content";

const { listPublishedSlugs } = vi.hoisted(() => ({
  listPublishedSlugs: vi.fn(),
}));
vi.mock("./contentDb", () => ({ listPublishedSlugs }));

const DEFAULT_ORIGIN = "https://www.seasonalsolutions.online";
const TEST_ORIGIN = "https://example.test";
const IMAGE_PATH = "/images/hero.jpg";

async function loadWithOrigin(origin: string | undefined) {
  vi.stubEnv("SITE_ORIGIN", origin);
  vi.resetModules();
  listPublishedSlugs.mockResolvedValue([]);
  const site = await import("../shared/site");
  const seo = await import("./seo");
  const sitemap = await import("./sitemap");
  return { ...site, ...seo, ...sitemap };
}

let server: Server | undefined;
afterEach(async () => {
  if (server) {
    const closing = server;
    server = undefined;
    closing.closeAllConnections();
    await new Promise<void>((resolve, reject) => {
      closing.close(error => (error ? reject(error) : resolve()));
    });
  }
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.clearAllMocks();
});

describe("T1 configurable site origin", () => {
  it.each([undefined, "", "   "])(
    "retains the existing domain when SITE_ORIGIN is %s",
    async origin => {
      const { SITE_ORIGIN, buildSeoHead, buildSitemap, buildRobots } =
        await loadWithOrigin(origin);
      expect(SITE_ORIGIN).toBe(DEFAULT_ORIGIN);
      expect(buildSeoHead("/")).toContain(
        `<link rel="canonical" href="${DEFAULT_ORIGIN}/" />`
      );
      expect(buildSeoHead("/")).toContain(`${DEFAULT_ORIGIN}${IMAGE_PATH}`);
      expect(await buildSitemap()).toContain(`<loc>${DEFAULT_ORIGIN}/</loc>`);
      expect(buildRobots()).toContain(
        `Sitemap: ${DEFAULT_ORIGIN}/sitemap.xml\n`
      );
    }
  );

  it("uses the configured origin for canonical, social image and service structured data", async () => {
    const { buildSeoHead } = await loadWithOrigin(TEST_ORIGIN);
    const head = buildSeoHead("/services/painting");
    expect(head).toContain(
      `<link rel="canonical" href="${TEST_ORIGIN}/services/painting" />`
    );
    expect(head).toContain(
      `<meta property="og:url" content="${TEST_ORIGIN}/services/painting" />`
    );
    expect(head).toContain(
      `<meta property="og:image" content="${TEST_ORIGIN}${IMAGE_PATH}" />`
    );
    expect(head).toContain(
      `<meta name="twitter:image" content="${TEST_ORIGIN}${IMAGE_PATH}" />`
    );
    const json = head.match(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/
    );
    expect(json).not.toBeNull();
    const [organization, service, breadcrumbs] = JSON.parse(json![1]);
    expect(organization.url).toBe(TEST_ORIGIN);
    expect(organization.logo).toBe(`${TEST_ORIGIN}/favicon.svg`);
    expect(organization.image).toBe(`${TEST_ORIGIN}${IMAGE_PATH}`);
    expect(service.url).toBe(`${TEST_ORIGIN}/services/painting`);
    expect(service.provider["@id"]).toBe(`${TEST_ORIGIN}/#organization`);
    expect(breadcrumbs.itemListElement[0].item).toBe(`${TEST_ORIGIN}/`);
    expect(head).not.toContain(DEFAULT_ORIGIN);
  });

  it("uses the same origin for article metadata and uploaded cover images", async () => {
    const { buildSeoHead } = await loadWithOrigin(TEST_ORIGIN);
    const post: PostDetail = {
      id: "post_origin-fixture",
      slug: "origin-fixture",
      title: "Origin test article",
      excerpt: "An isolated metadata fixture, not a published business claim.",
      body: "Fixture body.",
      category: "tips",
      serviceSlug: "painting",
      areaName: null,
      coverImageUrl: "/manus-storage/blog/test/cover.webp",
      coverImageAlt: "Fixture image",
      publishedAt: "2026-11-01T00:00:00.000Z",
      updatedAt: "2026-11-02T00:00:00.000Z",
      seoTitle: null,
      seoDescription: null,
    };
    const head = buildSeoHead("/blog/origin-fixture", { post });
    expect(head).toContain(`href="${TEST_ORIGIN}/blog/origin-fixture"`);
    expect(head).toContain(
      `content="${TEST_ORIGIN}/manus-storage/blog/test/cover.webp"`
    );
    expect(head).toContain(
      `"mainEntityOfPage":"${TEST_ORIGIN}/blog/origin-fixture"`
    );
    expect(head).not.toContain(DEFAULT_ORIGIN);
  });

  it("normalizes whitespace and trailing slashes to avoid double-slash URLs", async () => {
    const { SITE_ORIGIN, buildSeoHead, buildSitemap, buildRobots } =
      await loadWithOrigin(`  ${TEST_ORIGIN}///  `);
    expect(SITE_ORIGIN).toBe(TEST_ORIGIN);
    expect(buildSeoHead("/contact")).toContain(`href="${TEST_ORIGIN}/contact"`);
    expect(await buildSitemap()).not.toContain(`${TEST_ORIGIN}//`);
    expect(buildRobots()).toContain(`Sitemap: ${TEST_ORIGIN}/sitemap.xml\n`);
  });

  it("uses the configured origin for every sitemap URL, including published posts", async () => {
    const { INDEXABLE_PATHS, buildSitemap } = await loadWithOrigin(TEST_ORIGIN);
    listPublishedSlugs.mockResolvedValue([
      { slug: "origin-fixture", updatedAt: new Date("2026-11-02T00:00:00Z") },
    ]);
    const xml = await buildSitemap();
    const locations = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(
      match => match[1]
    );
    expect(locations).toEqual([
      ...INDEXABLE_PATHS.map(path => `${TEST_ORIGIN}${path}`),
      `${TEST_ORIGIN}/blog/origin-fixture`,
    ]);
    expect(xml).toContain("<lastmod>2026-11-02</lastmod>");
    expect(xml).not.toContain(DEFAULT_ORIGIN);
    expect(locations.some(url => /\/(admin|pay)(\/|$)/.test(url))).toBe(false);
  });

  it("serves dynamic robots and sitemap before a static fallback, independent of the request Host", async () => {
    const { registerSitemapRoute } = await loadWithOrigin(TEST_ORIGIN);
    const app = express();
    registerSitemapRoute(app);
    app.use((_req, res) => res.status(200).type("text/html").send("fallback"));
    server = createServer(app);
    await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const robots = await fetch(`${base}/robots.txt`, {
      headers: { Host: "untrusted-host.test" },
    });
    expect(robots.status).toBe(200);
    expect(robots.headers.get("content-type")).toContain("text/plain");
    expect(robots.headers.get("cache-control")).toBe("public, max-age=300");
    expect(await robots.text()).toBe(
      `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin/\nDisallow: /pay/\nSitemap: ${TEST_ORIGIN}/sitemap.xml\n`
    );
    const sitemap = await fetch(`${base}/sitemap.xml`);
    expect(sitemap.status).toBe(200);
    expect(sitemap.headers.get("content-type")).toContain("application/xml");
    expect(await sitemap.text()).toContain(`<loc>${TEST_ORIGIN}/</loc>`);
  });

  it("preserves noindex and omits absolute SEO URLs for private pages", async () => {
    const { buildSeoHead } = await loadWithOrigin(TEST_ORIGIN);
    for (const path of ["/admin", "/pay/abcdefghijklmnopqrstuvwx"]) {
      const head = buildSeoHead(path);
      expect(head).toContain("noindex");
      expect(head).not.toContain('rel="canonical"');
      expect(head).not.toContain('property="og:url"');
    }
  });
});
