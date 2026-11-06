/**
 * HANDOFF: Loads data for server-rendered pages and serializes it into the HTML.
 * `serializePageData` escapes <, >, & and U+2028/2029 so embedded JSON cannot break out of the script tag. Keep it.
 */
import { BLOG_POST_PATH, PAY_PATH, type PageData } from "../shared/content";
import { getServiceByPath, normalizePath } from "../shared/site";
import { getPublishedPost, listPublishedPosts } from "./contentDb";
import { getPublicPaymentRequest } from "./stripePayments";

export type LoadedPage = {
  data: PageData;
  /** True when a dynamic route matched but its record does not exist. */
  missing: boolean;
};

async function safe<T>(label: string, load: () => Promise<T>, fallback: T) {
  try {
    return await load();
  } catch (error) {
    console.error(
      `[SSR] Could not load ${label}:`,
      error instanceof Error ? error.message : "unknown error"
    );
    return fallback;
  }
}

/**
 * Loads only the public data a route needs. Failures degrade to an empty
 * feed so a database hiccup never takes the marketing pages offline.
 */
export async function loadPageData(pathname: string): Promise<LoadedPage> {
  const path = normalizePath(pathname);
  const postMatch = path.match(BLOG_POST_PATH);
  if (postMatch) {
    const post = await safe("post", () => getPublishedPost(postMatch[1]), null);
    if (!post) return { data: {}, missing: true };
    const related = await safe(
      "related posts",
      async () => {
        const sameService = post.serviceSlug
          ? await listPublishedPosts({
              serviceSlug: post.serviceSlug,
              excludeId: post.id,
              limit: 3,
            })
          : [];
        if (sameService.length >= 3) return sameService;
        const recent = await listPublishedPosts({
          excludeId: post.id,
          limit: 6,
        });
        const seen = new Set(sameService.map(item => item.id));
        return [
          ...sameService,
          ...recent.filter(item => !seen.has(item.id)),
        ].slice(0, 3);
      },
      []
    );
    return { data: { post, related }, missing: false };
  }
  const payMatch = path.match(PAY_PATH);
  if (payMatch) {
    const payment = await safe(
      "payment request",
      () => getPublicPaymentRequest(payMatch[1]),
      null
    );
    return payment
      ? { data: { payment }, missing: false }
      : { data: {}, missing: true };
  }
  if (path === "/blog") {
    const posts = await safe(
      "posts",
      () => listPublishedPosts({ limit: 60 }),
      []
    );
    return { data: { posts }, missing: false };
  }
  if (path === "/") {
    const posts = await safe(
      "posts",
      () => listPublishedPosts({ limit: 3 }),
      []
    );
    return { data: { posts }, missing: false };
  }
  if (path === "/our-work") {
    const posts = await safe(
      "project posts",
      () => listPublishedPosts({ category: "project", limit: 6 }),
      []
    );
    return { data: { posts }, missing: false };
  }
  const service = getServiceByPath(path);
  if (service) {
    const related = await safe(
      "service posts",
      () => listPublishedPosts({ serviceSlug: service.slug, limit: 3 }),
      []
    );
    return { data: { related }, missing: false };
  }
  return { data: {}, missing: false };
}

/** JSON safe to embed inside an inline <script> element. */
export function serializePageData(data: PageData): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
