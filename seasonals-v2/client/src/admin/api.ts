/**
 * HANDOFF: Admin fetch helper: sends the session cookie and, when present, a Bearer token from sessionStorage (preview fallback).
 * Never put secrets in client storage.
 */
import { SERVICES } from "../../../shared/site";

export function authHeaders(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem("app-session-token");
    const cookie = raw
      ?.split(";")
      .map(part => part.trim())
      .find(part => part.startsWith("webdev_app_session="));
    const token = cookie?.slice("webdev_app_session=".length);
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    credentials: "include",
    headers: {
      ...authHeaders(),
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const body = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };
  if (!response.ok)
    throw new ApiError(
      body.error || "The request could not be completed.",
      response.status
    );
  return body;
}

export function sendJson<T>(
  path: string,
  method: string,
  value: unknown
): Promise<T> {
  return api<T>(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
}

export function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

const CAD = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
});
const CAD_ROUND = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});

export function formatMoney(
  value: string | number | null | undefined,
  round = false
) {
  const amount = Number(value ?? 0);
  return (round ? CAD_ROUND : CAD).format(Number.isFinite(amount) ? amount : 0);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" });
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-CA", { dateStyle: "medium" });
}

/** Formats a YYYY-MM-DD business day without timezone shifting. */
export function formatDay(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
  });
}

export function timeAgo(value: string) {
  const minutes = Math.max(
    0,
    Math.round((Date.now() - new Date(value).getTime()) / 60000)
  );
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

export function serviceLabel(slug: string | null | undefined) {
  return SERVICES.find(service => service.slug === slug)?.label ?? slug ?? "—";
}

export const LEAD_STATUS_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  quoted: "Quoted",
  won: "Won",
  lost: "Lost",
  closed: "Closed",
};

export function sourceLabel(source: string, medium?: string | null) {
  const base = source === "direct" ? "Direct / unknown" : source;
  return medium && medium !== "none" && medium !== "referral"
    ? `${base} · ${medium}`
    : base;
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
