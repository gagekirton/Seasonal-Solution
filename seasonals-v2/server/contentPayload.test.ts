import { describe, expect, it } from "vitest";
import { contentInputPayload } from "../client/src/admin/contentPayload";

const fetched = {
  id: "post_00000000-0000-0000-0000-000000000000",
  status: "published",
  publishedAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
  title: " Winnipeg paint tips ",
  slug: "winnipeg-paint-tips",
  excerpt: " Useful scope notes ",
  body: "## Preparation\nCheck the surfaces.",
  category: "tips" as const,
  serviceSlug: "painting",
  areaName: " Winnipeg ",
  coverImageUrl: null,
  coverImageAlt: null,
  seoTitle: null,
  seoDescription: null,
};

describe("content editor write payload", () => {
  it("sends only writable fields when editing an existing published post", () => {
    const payload = contentInputPayload(fetched);
    expect(Object.keys(payload).sort()).toEqual(
      [
        "areaName",
        "body",
        "category",
        "coverImageAlt",
        "coverImageUrl",
        "excerpt",
        "seoDescription",
        "seoTitle",
        "serviceSlug",
        "slug",
        "title",
      ].sort()
    );
    expect(payload.title).toBe("Winnipeg paint tips");
    expect(payload.areaName).toBe("Winnipeg");
    expect(payload).not.toHaveProperty("status");
    expect(payload).not.toHaveProperty("id");
    expect(payload).not.toHaveProperty("publishedAt");
  });

  it("allows server-generated slugs and normalizes blank optional fields", () => {
    const payload = contentInputPayload({
      ...fetched,
      slug: "",
      areaName: " ",
      serviceSlug: "",
      seoTitle: " ",
    });
    expect(payload.slug).toBeUndefined();
    expect(payload.areaName).toBeNull();
    expect(payload.serviceSlug).toBeNull();
    expect(payload.seoTitle).toBeNull();
  });
});
