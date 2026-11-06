/**
 * HANDOFF: Blog posts and media records. Markdown is rendered WITHOUT raw HTML; keep it that way.
 * The in-memory cache is capped (200 entries) so arbitrary /blog/<slug> requests cannot grow it forever.
 */
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { mediaAssets, posts, type Post } from "../drizzle/schema";
import type { PostDetail, PostSummary } from "../shared/content";
import { slugify } from "../shared/content";
import { createCrmId } from "./crmDomain";
import { getDb } from "./db";

async function database() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db;
}

export type PostInput = {
  title: string;
  slug?: string;
  excerpt: string;
  body: string;
  category: Post["category"];
  serviceSlug: string | null;
  areaName: string | null;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
};

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export function toSummary(post: Post): PostSummary {
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    category: post.category,
    serviceSlug: post.serviceSlug,
    areaName: post.areaName,
    coverImageUrl: post.coverImageUrl,
    coverImageAlt: post.coverImageAlt,
    publishedAt: iso(post.publishedAt),
    updatedAt: post.updatedAt.toISOString(),
  };
}

export function toDetail(post: Post): PostDetail {
  return {
    ...toSummary(post),
    body: post.body,
    seoTitle: post.seoTitle,
    seoDescription: post.seoDescription,
  };
}

/** Generates an excerpt from Markdown when the owner leaves it blank. */
export function excerptFromMarkdown(body: string, max = 300): string {
  const text = body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~|-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 40)).trim()}…`;
}

const CACHE_TTL_MS = 60 * 1000;
const cache = new Map<string, { at: number; value: unknown }>();

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS)
    return Promise.resolve(hit.value as T);
  return load().then(value => {
    cache.set(key, { at: Date.now(), value });
    // Bound memory: arbitrary /blog/<slug> requests would otherwise add keys forever.
    if (cache.size > 200) {
      const now = Date.now();
      for (const [entryKey, entry] of cache)
        if (now - entry.at >= CACHE_TTL_MS) cache.delete(entryKey);
      while (cache.size > 200)
        cache.delete(cache.keys().next().value as string);
    }
    return value;
  });
}

export function invalidatePostCache() {
  cache.clear();
}

export async function listPublishedPosts(
  options: {
    limit?: number;
    category?: Post["category"];
    serviceSlug?: string;
    excludeId?: string;
  } = {}
): Promise<PostSummary[]> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
  const key = `list:${limit}:${options.category ?? ""}:${options.serviceSlug ?? ""}:${options.excludeId ?? ""}`;
  return cached(key, async () => {
    const db = await database();
    const filters = [eq(posts.status, "published")];
    if (options.category) filters.push(eq(posts.category, options.category));
    if (options.serviceSlug)
      filters.push(eq(posts.serviceSlug, options.serviceSlug));
    if (options.excludeId) filters.push(ne(posts.id, options.excludeId));
    const rows = await db
      .select()
      .from(posts)
      .where(and(...filters))
      .orderBy(desc(posts.publishedAt))
      .limit(limit);
    return rows.map(toSummary);
  });
}

export async function getPublishedPost(
  slug: string
): Promise<PostDetail | null> {
  return cached(`post:${slug}`, async () => {
    const db = await database();
    const [row] = await db
      .select()
      .from(posts)
      .where(and(eq(posts.slug, slug), eq(posts.status, "published")))
      .limit(1);
    return row ? toDetail(row) : null;
  });
}

export async function listPublishedSlugs() {
  const db = await database();
  return db
    .select({ slug: posts.slug, updatedAt: posts.updatedAt })
    .from(posts)
    .where(eq(posts.status, "published"))
    .orderBy(desc(posts.publishedAt))
    .limit(1000);
}

export async function listAllPosts() {
  const db = await database();
  const rows = await db
    .select()
    .from(posts)
    .orderBy(desc(posts.updatedAt))
    .limit(500);
  return rows.map(post => ({ ...toDetail(post), status: post.status }));
}

export async function getPost(id: string) {
  const db = await database();
  const [row] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  return row ? { ...toDetail(row), status: row.status } : null;
}

async function slugTaken(slug: string, exceptId?: string) {
  const db = await database();
  const [row] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(
      exceptId
        ? and(eq(posts.slug, slug), ne(posts.id, exceptId))
        : eq(posts.slug, slug)
    )
    .limit(1);
  return Boolean(row);
}

async function uniqueSlug(base: string, exceptId?: string) {
  const root = base || "post";
  for (let attempt = 1; attempt < 50; attempt += 1) {
    const candidate = attempt === 1 ? root : `${root}-${attempt}`;
    if (!(await slugTaken(candidate, exceptId))) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export async function createPost(input: PostInput) {
  const db = await database();
  const id = createCrmId("post");
  const slug = await uniqueSlug(slugify(input.slug || input.title));
  await db.insert(posts).values({
    id,
    slug,
    title: input.title,
    excerpt: input.excerpt || excerptFromMarkdown(input.body),
    body: input.body,
    category: input.category,
    serviceSlug: input.serviceSlug,
    areaName: input.areaName,
    coverImageUrl: input.coverImageUrl,
    coverImageAlt: input.coverImageAlt,
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription,
    status: "draft",
  });
  invalidatePostCache();
  return getPost(id);
}

export async function updatePost(id: string, input: PostInput) {
  const db = await database();
  const existing = await getPost(id);
  if (!existing) return { error: "not_found" as const };
  const slug = slugify(input.slug || input.title) || existing.slug;
  if (await slugTaken(slug, id)) return { error: "slug_taken" as const };
  await db
    .update(posts)
    .set({
      slug,
      title: input.title,
      excerpt: input.excerpt || excerptFromMarkdown(input.body),
      body: input.body,
      category: input.category,
      serviceSlug: input.serviceSlug,
      areaName: input.areaName,
      coverImageUrl: input.coverImageUrl,
      coverImageAlt: input.coverImageAlt,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      updatedAt: new Date(),
    })
    .where(eq(posts.id, id));
  invalidatePostCache();
  return { post: await getPost(id) };
}

export async function setPostPublished(id: string, publish: boolean) {
  const db = await database();
  const now = new Date();
  const result = await db
    .update(posts)
    .set(
      publish
        ? {
            status: "published",
            publishedAt: sql`COALESCE(${posts.publishedAt}, ${now})`,
            updatedAt: now,
          }
        : { status: "draft", updatedAt: now }
    )
    .where(eq(posts.id, id));
  invalidatePostCache();
  if (Number(result[0]?.affectedRows ?? 0) === 0) return null;
  return getPost(id);
}

export async function deletePost(id: string) {
  const db = await database();
  const result = await db.delete(posts).where(eq(posts.id, id));
  invalidatePostCache();
  return Number(result[0]?.affectedRows ?? 0) > 0;
}

export async function recordMedia(input: {
  storageKey: string;
  url: string;
  contentType: string;
  byteSize: number;
  originalName: string | null;
  uploadedBy: string;
}) {
  const db = await database();
  const id = createCrmId("img");
  await db.insert(mediaAssets).values({ id, ...input });
  return { id, url: input.url };
}

export async function listMedia(limit = 60) {
  const db = await database();
  return db
    .select({
      id: mediaAssets.id,
      url: mediaAssets.url,
      originalName: mediaAssets.originalName,
      createdAt: mediaAssets.createdAt,
    })
    .from(mediaAssets)
    .orderBy(desc(mediaAssets.createdAt))
    .limit(Math.min(limit, 200));
}
