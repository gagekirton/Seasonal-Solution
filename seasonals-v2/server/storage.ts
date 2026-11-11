// Storage helpers backed by a directory on the app's own disk.
// Uploads are written under STORAGE_DIR (default "data/uploads") and downloads
// are served by the /manus-storage/* route (server/_core/storageProxy.ts). The
// route path is unchanged from the old template so URLs already stored in
// content keep working. (Replaced the Manus Forge storage in the 2026-11-11
// rebuild.)

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { ENV } from "./_core/env";

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export function storageRoot(): string {
  return path.resolve(ENV.storageDir);
}

/** Resolves a storage key to an absolute path, refusing keys that escape the storage root. */
export function storagePathForKey(key: string): string {
  const root = storageRoot();
  const dest = path.resolve(root, normalizeKey(key));
  if (dest !== root && !dest.startsWith(root + path.sep)) {
    throw new Error("Invalid storage key");
  }
  return dest;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  _contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const dest = storagePathForKey(key);
  await mkdir(path.dirname(dest), { recursive: true });
  const buffer =
    typeof data === "string"
      ? Buffer.from(data)
      : Buffer.from(data as Uint8Array);
  await writeFile(dest, buffer);
  return { key, url: `/manus-storage/${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/manus-storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  // Files are served directly by the app, so the public path is the URL.
  const { url } = await storageGet(relKey);
  return url;
}
