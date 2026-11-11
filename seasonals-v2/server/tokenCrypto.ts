/**
 * HANDOFF: AES-GCM encryption for stored integration tokens.
 * The key is derived from JWT_SECRET (MANUS_JWT_SECRET is still honoured as a
 * fallback for tokens sealed before the 2026-11-11 rebuild). If that secret
 * changes, stored tokens become unreadable and QuickBooks must be reconnected.
 * A dedicated key would be safer (optional hardening).
 */
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "crypto";

function key(): Buffer {
  const secret = process.env.JWT_SECRET ?? process.env.MANUS_JWT_SECRET ?? "";
  if (!secret) throw new Error("Token encryption secret is not configured");
  return Buffer.from(
    hkdfSync("sha256", secret, "seasonal-solutions", "integration-token-v1", 32)
  );
}

/** Encrypts a token as v1.<iv>.<tag>.<ciphertext> (base64url parts). */
export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    data.toString("base64url"),
  ].join(".");
}

export function decryptToken(sealed: string): string {
  const [version, iv, tag, data] = sealed.split(".");
  if (version !== "v1" || !iv || !tag || !data)
    throw new Error("Unsupported token format");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(iv, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(data, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
