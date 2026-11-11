/**
 * HANDOFF: Blog and media admin endpoints.
 * - Uploads are signature-checked and size-limited but EXIF/GPS metadata is NOT stripped (NEXT-TASKS T5).
 * - Cover images must be /manus-storage/ URLs, served by the app's own storage (server/storage.ts).
 */
import express, { type Express } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import { SERVICES } from "../shared/site";
import { POST_CATEGORIES, SLUG_PATTERN } from "../shared/content";
import {
  createPost,
  deletePost,
  getPost,
  listAllPosts,
  listMedia,
  recordMedia,
  setPostPublished,
  updatePost,
} from "./contentDb";
import { adminRoute, requireJson } from "./http";
import { storagePut } from "./storage";

const postIdSchema = z.string().regex(/^post_[0-9a-f-]{36}$/i);
export function isPostBodyWithinStorage(body: string): boolean {
  return Buffer.byteLength(body, "utf8") <= 65535;
}
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform(value => (value ? value : null));

const postSchema = z
  .object({
    title: z.string().trim().min(3).max(140),
    slug: z
      .string()
      .trim()
      .max(100)
      .optional()
      .refine(value => !value || SLUG_PATTERN.test(value), "Invalid slug"),
    excerpt: z.string().trim().max(320).optional().default(""),
    body: z
      .string()
      .trim()
      .min(1)
      .max(50000)
      .refine(isPostBodyWithinStorage, "Article is too large in UTF-8 bytes"),
    category: z.enum(
      POST_CATEGORIES.map(category => category.value) as [
        "tips",
        "project",
        "news",
      ]
    ),
    serviceSlug: z
      .string()
      .nullable()
      .optional()
      .transform(value => value || null)
      .refine(
        value => !value || SERVICES.some(service => service.slug === value),
        "Unknown service"
      ),
    areaName: optionalText(120),
    coverImageUrl: z
      .string()
      .trim()
      .max(512)
      .nullable()
      .optional()
      .transform(value => value || null)
      .refine(
        value => !value || /^\/manus-storage\/[A-Za-z0-9._/-]+$/.test(value),
        "Cover images must be uploaded to the site"
      ),
    coverImageAlt: optionalText(200),
    seoTitle: optionalText(80),
    seoDescription: optionalText(180),
  })
  .strict();

const IMAGE_TYPES: Record<
  string,
  { ext: string; magic: (b: Buffer) => boolean }
> = {
  "image/jpeg": {
    ext: "jpg",
    magic: b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  "image/png": {
    ext: "png",
    magic: b =>
      b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  },
  "image/webp": {
    ext: "webp",
    magic: b =>
      b.subarray(0, 4).toString("ascii") === "RIFF" &&
      b.subarray(8, 12).toString("ascii") === "WEBP",
  },
};
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export function isAllowedImage(contentType: string, bytes: Buffer): boolean {
  const type = IMAGE_TYPES[contentType];
  return Boolean(type && bytes.length >= 12 && type.magic(bytes));
}

export function registerContentRoutes(app: Express) {
  app.get(
    "/api/admin/posts",
    adminRoute("list posts", async (_req, res) => {
      res.json({ posts: await listAllPosts() });
    })
  );

  app.get(
    "/api/admin/posts/:id",
    adminRoute("get post", async (req, res) => {
      const id = postIdSchema.safeParse(req.params.id);
      const post = id.success ? await getPost(id.data) : null;
      if (!post) {
        res.status(404).json({ error: "Post not found." });
        return;
      }
      res.json({ post });
    })
  );

  app.post(
    "/api/admin/posts",
    adminRoute("create post", async (req, res) => {
      if (!requireJson(req, res)) return;
      const parsed = postSchema.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: "Check the title, body and other post fields." });
        return;
      }
      res.status(201).json({ post: await createPost(parsed.data) });
    })
  );

  app.put(
    "/api/admin/posts/:id",
    adminRoute("update post", async (req, res) => {
      if (!requireJson(req, res)) return;
      const id = postIdSchema.safeParse(req.params.id);
      const parsed = postSchema.safeParse(req.body);
      if (!id.success || !parsed.success) {
        res
          .status(400)
          .json({ error: "Check the title, body and other post fields." });
        return;
      }
      const result = await updatePost(id.data, parsed.data);
      if ("error" in result) {
        res.status(result.error === "not_found" ? 404 : 409).json({
          error:
            result.error === "not_found"
              ? "Post not found."
              : "Another post already uses that web address (slug).",
        });
        return;
      }
      res.json({ post: result.post });
    })
  );

  app.post(
    "/api/admin/posts/:id/publish",
    adminRoute("publish post", async (req, res) => {
      if (!requireJson(req, res)) return;
      const id = postIdSchema.safeParse(req.params.id);
      const parsed = z
        .object({ publish: z.boolean() })
        .strict()
        .safeParse(req.body);
      if (!id.success || !parsed.success) {
        res.status(400).json({ error: "Invalid publish request." });
        return;
      }
      const post = await setPostPublished(id.data, parsed.data.publish);
      if (!post) {
        res.status(404).json({ error: "Post not found." });
        return;
      }
      res.json({ post });
    })
  );

  app.delete(
    "/api/admin/posts/:id",
    adminRoute("delete post", async (req, res) => {
      const id = postIdSchema.safeParse(req.params.id);
      if (!id.success || !(await deletePost(id.data))) {
        res.status(404).json({ error: "Post not found." });
        return;
      }
      res.json({ success: true });
    })
  );

  app.get(
    "/api/admin/media",
    adminRoute("list media", async (_req, res) => {
      res.json({ media: await listMedia() });
    })
  );

  app.post(
    "/api/admin/media",
    express.raw({
      type: Object.keys(IMAGE_TYPES),
      limit: MAX_IMAGE_BYTES,
    }),
    adminRoute("upload media", async (req, res, user) => {
      const contentType = (req.get("content-type") ?? "").split(";")[0].trim();
      const bytes = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      if (!isAllowedImage(contentType, bytes)) {
        res
          .status(415)
          .json({ error: "Upload a JPEG, PNG or WebP image up to 8 MB." });
        return;
      }
      const month = new Date().toISOString().slice(0, 7);
      const ext = IMAGE_TYPES[contentType].ext;
      const stored = await storagePut(
        `blog/${month}/${randomUUID()}.${ext}`,
        bytes,
        contentType
      );
      const rawName = req.get("x-file-name") ?? "";
      let originalName: string | null = null;
      try {
        originalName = decodeURIComponent(rawName).slice(0, 160) || null;
      } catch {
        originalName = null;
      }
      const media = await recordMedia({
        storageKey: stored.key,
        url: stored.url,
        contentType,
        byteSize: bytes.length,
        originalName,
        uploadedBy: user.openId,
      });
      res.status(201).json({ media });
    })
  );
}
