import { mkdtemp, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { COOKIE_NAME } from "../shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { notifyOwner } from "./_core/notification";
import { hashPassword, verifyPassword } from "./_core/password";
import { sdk } from "./_core/sdk";
import { storageGet, storagePathForKey, storagePut } from "./storage";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("owned platform integration", () => {
  it("uses a distinct app session cookie", () => {
    expect(COOKIE_NAME).not.toBe("app_session_id");
    expect(COOKIE_NAME.length).toBeGreaterThan(0);
  });

  it("binds signed app sessions to this project and accepts an empty display name", async () => {
    vi.stubEnv("APP_ID", "project-test");
    vi.stubEnv("JWT_SECRET", "unit-test-signing-key-never-deployed");
    const token = await sdk.signSession({
      openId: "user-test",
      appId: "project-test",
      name: "",
    });
    expect(await sdk.verifySession(token)).toMatchObject({
      openId: "user-test",
    });
    vi.stubEnv("APP_ID", "different-project");
    expect(await sdk.verifySession(token)).toBeNull();
  });

  it("sets a Lax first-party cookie, Secure only when the request is HTTPS", () => {
    expect(
      getSessionCookieOptions({ protocol: "http", headers: {} } as never)
    ).toMatchObject({ secure: false, httpOnly: true, sameSite: "lax" });
    expect(
      getSessionCookieOptions({
        protocol: "http",
        headers: { "x-forwarded-proto": "https" },
      } as never)
    ).toMatchObject({ secure: true, httpOnly: true, sameSite: "lax" });
  });

  it("hashes passwords with scrypt and verifies them in constant shape", async () => {
    const stored = await hashPassword("a-test-password");
    expect(stored).toMatch(/^scrypt:/);
    expect(stored).not.toContain("a-test-password");
    expect(await verifyPassword("a-test-password", stored)).toBe(true);
    expect(await verifyPassword("wrong-password", stored)).toBe(false);
    expect(await verifyPassword("a-test-password", null)).toBe(false);
    expect(await verifyPassword("a-test-password", "garbage")).toBe(false);
  });

  it("stores uploads on local disk and serves them under the storage path", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "seasonal-storage-"));
    try {
      vi.stubEnv("STORAGE_DIR", dir);
      const stored = await storagePut("blog/test/cover.txt", "hello", "text/plain");
      expect(stored.url).toMatch(/^\/manus-storage\/blog\/test\/cover_.+\.txt$/);
      const onDisk = await readFile(storagePathForKey(stored.key), "utf8");
      expect(onDisk).toBe("hello");
      expect(await storageGet(stored.key)).toEqual({
        key: stored.key,
        url: stored.url,
      });
      expect(() => storagePathForKey("../escape.txt")).toThrow(
        "Invalid storage key"
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("drops owner alerts quietly when email is not configured, but still validates", async () => {
    vi.stubEnv("SMTP_HOST", "");
    vi.stubEnv("ALERT_EMAIL_TO", "");
    vi.stubEnv("OWNER_EMAIL", "");
    await expect(
      notifyOwner({ title: "Test alert", content: "Something happened" })
    ).resolves.toBe(false);
    await expect(notifyOwner({ title: "", content: "x" })).rejects.toThrow(
      "Notification title is required."
    );
  });
});
