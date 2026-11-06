import React, {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Eye,
  FilePlus2,
  ImagePlus,
  Pencil,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { POST_CATEGORIES, slugify } from "../../../shared/content";
import { SERVICES } from "../../../shared/site";
import { AdminFrame, Notice, Panel } from "./AdminShell";
import { api, authHeaders, errorText, formatDate, sendJson } from "./api";
import { contentInputPayload } from "./contentPayload";

type Post = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  category: "tips" | "project" | "news";
  serviceSlug: string | null;
  areaName: string | null;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  status: "draft" | "published";
  publishedAt: string | null;
  updatedAt: string;
};

type Media = {
  id: string;
  url: string;
  originalName: string | null;
  createdAt: string;
};
type Draft = Omit<Post, "id" | "status" | "publishedAt" | "updatedAt">;

const blankDraft = (): Draft => ({
  title: "",
  slug: "",
  excerpt: "",
  body: "",
  category: "tips",
  serviceSlug: null,
  areaName: null,
  coverImageUrl: null,
  coverImageAlt: null,
  seoTitle: null,
  seoDescription: null,
});

function inputPayload(draft: Draft) {
  return contentInputPayload(draft);
}

function PostEditor({
  post,
  media,
  onClose,
  onSaved,
  onUpload,
}: {
  post: Post | null;
  media: Media[];
  onClose: () => void;
  onSaved: (post: Post) => void;
  onUpload: (file: File) => Promise<Media | null>;
}) {
  const [draft, setDraft] = useState<Draft>(post ? { ...post } : blankDraft());
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState<{
    kind: "error" | "success";
    text: string;
  } | null>(null);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft(current => ({ ...current, [key]: value }));
  const suggestedSlug = useMemo(() => slugify(draft.title), [draft.title]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const result = post
        ? await sendJson<{ post: Post }>(
            `/api/admin/posts/${post.id}`,
            "PUT",
            inputPayload(draft)
          )
        : await sendJson<{ post: Post }>(
            "/api/admin/posts",
            "POST",
            inputPayload(draft)
          );
      onSaved(result.post);
      setMessage({
        kind: "success",
        text:
          post?.status === "published"
            ? "Published post updated."
            : post
              ? "Draft saved."
              : "Draft created.",
      });
    } catch (error) {
      setMessage({
        kind: "error",
        text: errorText(error, "The post could not be saved."),
      });
    } finally {
      setSaving(false);
    }
  }

  async function pickFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    setMessage(null);
    const uploaded = await onUpload(file);
    setUploading(false);
    if (uploaded) {
      set("coverImageUrl", uploaded.url);
      if (!draft.coverImageAlt)
        set("coverImageAlt", draft.title || uploaded.originalName || "");
    }
  }

  return (
    <form className="content-editor" onSubmit={submit}>
      <div className="content-editor-head">
        <div>
          <span className="dash-kicker">{post ? "EDITING" : "NEW DRAFT"}</span>
          <h2>{post ? post.title || "Untitled post" : "Write a post"}</h2>
          {post?.status === "published" && (
            <p className="dash-empty">
              Saving updates this published article immediately. Unpublish it
              first if you want to work privately.
            </p>
          )}
        </div>
        <button
          className="button button-outline button-small"
          type="button"
          onClick={onClose}
        >
          <X size={15} /> Close
        </button>
      </div>
      <div className="content-fields">
        <label className="content-title-field">
          Title <b>*</b>
          <input
            required
            minLength={3}
            maxLength={140}
            value={draft.title}
            onChange={event => set("title", event.target.value)}
            placeholder="e.g., A spring yard checklist for Winnipeg homes"
          />
        </label>
        <label>
          Web address (slug)
          <input
            maxLength={100}
            value={draft.slug}
            onChange={event =>
              set(
                "slug",
                event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
              )
            }
            placeholder={suggestedSlug || "created-from-title"}
          />
          <small>
            Lowercase letters, numbers and hyphens only. Leave blank to create
            it from the title.
          </small>
        </label>
        <label>
          Topic <b>*</b>
          <select
            value={draft.category}
            onChange={event =>
              set("category", event.target.value as Draft["category"])
            }
          >
            {POST_CATEGORIES.map(category => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Related service
          <select
            value={draft.serviceSlug ?? ""}
            onChange={event => set("serviceSlug", event.target.value || null)}
          >
            <option value="">Not service-specific</option>
            {SERVICES.map(service => (
              <option key={service.slug} value={service.slug}>
                {service.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Area mentioned
          <input
            maxLength={120}
            value={draft.areaName ?? ""}
            onChange={event => set("areaName", event.target.value || null)}
            placeholder="e.g., Winnipeg"
          />
        </label>
        <label className="content-wide">
          Short description
          <textarea
            rows={2}
            maxLength={320}
            value={draft.excerpt}
            onChange={event => set("excerpt", event.target.value)}
            placeholder="A concise, useful summary shown on the blog and in social previews."
          />
          <small>{draft.excerpt.length}/320 characters</small>
        </label>
        <label className="content-wide">
          Article <b>*</b>
          <textarea
            className="content-body"
            required
            minLength={1}
            maxLength={50000}
            rows={16}
            value={draft.body}
            onChange={event => set("body", event.target.value)}
            placeholder={
              "Use plain text or Markdown.\n\n## A useful heading\n\n- A practical detail\n- Another helpful point"
            }
          />
          <small>
            Markdown is supported. Never include customer details or payment
            credentials.
          </small>
        </label>
      </div>
      <Panel title="Cover image" className="content-image-panel">
        <div className="content-cover-tools">
          <div className="content-cover-preview">
            {draft.coverImageUrl ? (
              <img src={draft.coverImageUrl} alt="Current post cover" />
            ) : (
              <span>
                <ImagePlus size={22} /> No cover image selected
              </span>
            )}
          </div>
          <div>
            <label className="button button-outline button-small content-upload-button">
              <Upload size={15} /> {uploading ? "Uploading…" : "Upload image"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploading}
                onChange={pickFile}
              />
            </label>
            <p>
              JPEG, PNG or WebP up to 8 MB. The image is stored with this site.
            </p>
            {media.length > 0 && (
              <div
                className="media-picker"
                aria-label="Previously uploaded images"
              >
                {media.slice(0, 12).map(item => (
                  <button
                    key={item.id}
                    type="button"
                    className={
                      draft.coverImageUrl === item.url ? "media-picked" : ""
                    }
                    onClick={() => set("coverImageUrl", item.url)}
                  >
                    <img
                      src={item.url}
                      alt={item.originalName ?? "Uploaded image"}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {draft.coverImageUrl && (
          <label>
            Image description (alt text)
            <input
              required
              maxLength={200}
              value={draft.coverImageAlt ?? ""}
              onChange={event =>
                set("coverImageAlt", event.target.value || null)
              }
              placeholder="Describe the image for visitors using screen readers"
            />
          </label>
        )}
      </Panel>
      <details className="content-seo-details">
        <summary>Search preview settings (optional)</summary>
        <div className="content-fields">
          <label>
            Search title
            <input
              maxLength={80}
              value={draft.seoTitle ?? ""}
              onChange={event => set("seoTitle", event.target.value || null)}
              placeholder={draft.title || "Uses the post title by default"}
            />
          </label>
          <label>
            Search description
            <textarea
              rows={2}
              maxLength={180}
              value={draft.seoDescription ?? ""}
              onChange={event =>
                set("seoDescription", event.target.value || null)
              }
              placeholder={
                draft.excerpt || "Uses the short description by default"
              }
            />
          </label>
        </div>
      </details>
      <Notice kind={message?.kind}>{message?.text}</Notice>
      <div className="content-editor-actions">
        <button
          className="button button-primary"
          disabled={saving}
          type="submit"
        >
          {saving
            ? "Saving…"
            : post?.status === "published"
              ? "Save published changes"
              : "Save draft"}
        </button>
        <button
          className="button button-outline"
          type="button"
          onClick={() => setPreview(value => !value)}
        >
          <Eye size={15} /> {preview ? "Hide preview" : "Preview draft"}
        </button>
        {post?.status === "published" && (
          <a
            className="button button-outline"
            href={`/blog/${post.slug}`}
            target="_blank"
            rel="noreferrer"
          >
            View post <Eye size={15} />
          </a>
        )}
      </div>
      {preview && (
        <section className="content-draft-preview" aria-label="Draft preview">
          <span className="dash-kicker">DRAFT PREVIEW</span>
          <h1>{draft.title || "Untitled post"}</h1>
          {draft.excerpt && (
            <p className="content-preview-excerpt">{draft.excerpt}</p>
          )}
          {draft.coverImageUrl && (
            <img src={draft.coverImageUrl} alt={draft.coverImageAlt ?? ""} />
          )}
          <div className="article-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {draft.body}
            </ReactMarkdown>
          </div>
        </section>
      )}
    </form>
  );
}

export function ContentPage() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [media, setMedia] = useState<Media[]>([]);
  const [editing, setEditing] = useState<Post | null | "new">(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const refresh = () => {
    setError("");
    void Promise.all([
      api<{ posts: Post[] }>("/api/admin/posts"),
      api<{ media: Media[] }>("/api/admin/media"),
    ])
      .then(([postResult, mediaResult]) => {
        setPosts(postResult.posts);
        setMedia(mediaResult.media);
      })
      .catch(err => setError(errorText(err, "Content could not be loaded.")));
  };
  useEffect(refresh, []);

  async function upload(file: File) {
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 8 * 1024 * 1024
    ) {
      setError("Upload a JPEG, PNG or WebP image smaller than 8 MB.");
      return null;
    }
    try {
      const response = await fetch("/api/admin/media", {
        method: "POST",
        credentials: "include",
        headers: {
          ...authHeaders(),
          "Content-Type": file.type,
          "x-file-name": encodeURIComponent(file.name),
        },
        body: file,
      });
      const body = (await response.json().catch(() => ({}))) as {
        media?: Media;
        error?: string;
      };
      if (!response.ok || !body.media)
        throw new Error(body.error || "Image upload failed.");
      setMedia(current => [body.media!, ...current]);
      return body.media;
    } catch (err) {
      setError(errorText(err, "Image upload failed."));
      return null;
    }
  }

  async function publish(post: Post, next: boolean) {
    setBusyId(post.id);
    try {
      const result = await sendJson<{ post: Post }>(
        `/api/admin/posts/${post.id}/publish`,
        "POST",
        { publish: next }
      );
      setPosts(
        current =>
          current?.map(item => (item.id === post.id ? result.post : item)) ??
          null
      );
    } catch (err) {
      setError(errorText(err, "Post status could not be changed."));
    } finally {
      setBusyId("");
    }
  }

  async function destroy(post: Post) {
    if (!window.confirm(`Delete “${post.title}”? This cannot be undone.`))
      return;
    setBusyId(post.id);
    try {
      await api(`/api/admin/posts/${post.id}`, { method: "DELETE" });
      setPosts(current => current?.filter(item => item.id !== post.id) ?? null);
      if (editing === post) setEditing(null);
    } catch (err) {
      setError(errorText(err, "Post could not be deleted."));
    } finally {
      setBusyId("");
    }
  }

  const postForEditor = editing === "new" ? null : editing;
  return (
    <AdminFrame
      current="content"
      title="Content studio"
      description="Publish useful local project notes and home-care tips that earn repeat visitors and strengthen search visibility."
      actions={
        <button
          className="button button-primary button-small"
          type="button"
          onClick={() => setEditing("new")}
        >
          <FilePlus2 size={15} /> New post
        </button>
      }
    >
      <Notice>{error}</Notice>
      {editing !== null ? (
        <PostEditor
          key={postForEditor?.id ?? "new"}
          post={postForEditor}
          media={media}
          onClose={() => setEditing(null)}
          onUpload={upload}
          onSaved={saved => {
            setPosts(current => {
              const found = current?.some(item => item.id === saved.id);
              return found
                ? current!.map(item => (item.id === saved.id ? saved : item))
                : [saved, ...(current ?? [])];
            });
            setEditing(saved);
          }}
        />
      ) : !posts ? (
        <div className="admin-state">
          <span className="loader-dot" /> Loading content…
        </div>
      ) : posts.length === 0 ? (
        <div className="empty-inbox">
          <FilePlus2 size={27} />
          <h2>Your first post starts here</h2>
          <p>
            Share a practical local tip, a seasonal checklist or a project note.
            Drafts stay private until you publish them.
          </p>
          <button
            className="button button-primary"
            type="button"
            onClick={() => setEditing("new")}
          >
            Write the first post
          </button>
        </div>
      ) : (
        <div className="post-manager-list">
          {posts.map(post => (
            <article className="post-manager-card" key={post.id}>
              <div className="post-manager-thumb">
                {post.coverImageUrl ? (
                  <img src={post.coverImageUrl} alt="" />
                ) : (
                  <span>S/S</span>
                )}
              </div>
              <div className="post-manager-copy">
                <span
                  className={`lead-status ${post.status === "published" ? "status-won" : "status-new"}`}
                >
                  {post.status}
                </span>
                <h2>{post.title}</h2>
                <p>{post.excerpt || "No short description yet."}</p>
                <small>
                  Updated {formatDate(post.updatedAt)} · /blog/{post.slug}
                </small>
              </div>
              <div className="post-manager-actions">
                <button
                  className="button button-outline button-small"
                  type="button"
                  onClick={() => setEditing(post)}
                >
                  <Pencil size={14} /> Edit
                </button>
                <button
                  className="button button-primary button-small"
                  type="button"
                  disabled={busyId === post.id}
                  onClick={() =>
                    void publish(post, post.status !== "published")
                  }
                >
                  {post.status === "published" ? "Unpublish" : "Publish"}
                </button>
                <button
                  className="icon-button-danger"
                  type="button"
                  aria-label={`Delete ${post.title}`}
                  disabled={busyId === post.id}
                  onClick={() => void destroy(post)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </AdminFrame>
  );
}
