import { describe, expect, it } from "vitest";
import { classifySource, isTrackablePath } from "./analytics";
import { excerptFromMarkdown } from "./contentDb";
import { isAllowedImage, isPostBodyWithinStorage } from "./contentRoutes";
import { serializePageData } from "./ssrData";

describe("first-party analytics privacy and attribution", () => {
  it("tracks only public canonical-looking paths", () => {
    expect(isTrackablePath("/services/painting")).toBe("/services/painting");
    expect(isTrackablePath("/admin/leads")).toBeNull();
    expect(isTrackablePath("/pay/not-a-customer-token")).toBeNull();
    expect(isTrackablePath("https://example.com")).toBeNull();
  });

  it("classifies common external sources without retaining the full referrer", () => {
    expect(
      classifySource({
        referrer: "https://www.google.ca/search?q=handyman",
        utmSource: "",
        utmMedium: "",
      })
    ).toEqual({
      source: "google",
      medium: "organic",
    });
    expect(
      classifySource({
        referrer: "https://www.facebook.com/some-page",
        utmSource: "",
        utmMedium: "",
      })
    ).toEqual({
      source: "facebook",
      medium: "social",
    });
    expect(
      classifySource({
        referrer: "",
        utmSource: "Neighbourhood newsletter",
        utmMedium: "email",
      })
    ).toEqual({
      source: "neighbourhood newsletter",
      medium: "email",
    });
  });
});

describe("content and SSR safety", () => {
  it("checks UTF-8 bytes rather than JavaScript character count for article storage", () => {
    expect(isPostBodyWithinStorage("a".repeat(50000))).toBe(true);
    expect(isPostBodyWithinStorage("é".repeat(40000))).toBe(false);
  });

  it("creates a concise plain-text excerpt from Markdown", () => {
    expect(
      excerptFromMarkdown(
        "# Spring checklist\n\n- Clear eavestroughs\n- Inspect caulking",
        80
      )
    ).toBe("Spring checklist Clear eavestroughs Inspect caulking");
  });

  it("accepts image data only when declared type and magic bytes agree", () => {
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
    expect(isAllowedImage("image/png", png)).toBe(true);
    expect(isAllowedImage("image/jpeg", png)).toBe(false);
  });

  it("escapes page data before embedding it in inline HTML", () => {
    const value = serializePageData({
      posts: [
        {
          id: "post_1",
          slug: "safe",
          title: "<script>",
          excerpt: "&",
          category: "tips",
          serviceSlug: null,
          areaName: null,
          coverImageUrl: null,
          coverImageAlt: null,
          publishedAt: null,
          updatedAt: "2026-01-01",
        },
      ],
    });
    expect(value).not.toContain("<script>");
    expect(value).toContain("\\u003cscript\\u003e");
  });
});
