import type { PostDetail } from "../../../shared/content";

export type PostDraft = Omit<PostDetail, "id" | "publishedAt" | "updatedAt">;

/** Never spread a fetched record into a strict write API payload. */
export function contentInputPayload(draft: PostDraft) {
  return {
    title: draft.title.trim(),
    body: draft.body,
    category: draft.category,
    slug: draft.slug.trim() || undefined,
    excerpt: draft.excerpt.trim(),
    serviceSlug: draft.serviceSlug || null,
    areaName: draft.areaName?.trim() || null,
    coverImageUrl: draft.coverImageUrl || null,
    coverImageAlt: draft.coverImageAlt?.trim() || null,
    seoTitle: draft.seoTitle?.trim() || null,
    seoDescription: draft.seoDescription?.trim() || null,
  };
}
