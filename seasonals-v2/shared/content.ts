export const POST_CATEGORIES = [
  { value: "tips", label: "Home tips" },
  { value: "project", label: "Project notes" },
  { value: "news", label: "News" },
] as const;

export type PostCategory = (typeof POST_CATEGORIES)[number]["value"];

export type PostSummary = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: PostCategory;
  serviceSlug: string | null;
  areaName: string | null;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  publishedAt: string | null;
  updatedAt: string;
};

export type PostDetail = PostSummary & {
  body: string;
  seoTitle: string | null;
  seoDescription: string | null;
};

export type PublicPaymentRequest = {
  token: string;
  description: string;
  amount: string;
  currency: string;
  status: "open" | "paid" | "cancelled";
  customerFirstName: string;
  serviceLabel: string;
  paidAt: string | null;
  stripeReady: boolean;
};

/** Route data loaded on the server and reused for hydration. */
export type PageData = {
  posts?: PostSummary[];
  post?: PostDetail;
  related?: PostSummary[];
  payment?: PublicPaymentRequest;
};

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const BLOG_POST_PATH = /^\/blog\/([a-z0-9]+(?:-[a-z0-9]+)*)$/;
export const PAY_PATH = /^\/pay\/([A-Za-z0-9_-]{20,64})$/;

export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
    .replace(/-+$/g, "");
}

export function categoryLabel(value: string): string {
  return (
    POST_CATEGORIES.find(category => category.value === value)?.label ?? value
  );
}

export function formatPostDate(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Winnipeg",
  });
}
