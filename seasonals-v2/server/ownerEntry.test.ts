import express from "express";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import React from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SiteLayout } from "../client/src/Layout";
import { OwnerAccessGate } from "../client/src/admin/AdminShell";
import { COOKIE_NAME } from "../shared/const";
import { registerAuthRoutes } from "./_core/auth";
import { hashPassword } from "./_core/password";

const mocks = vi.hoisted(() => ({
  createSessionToken: vi.fn(),
  getUserByEmail: vi.fn(),
  getUserByOpenId: vi.fn(),
  upsertUser: vi.fn(),
  setUserPasswordHash: vi.fn(),
}));

vi.mock("./_core/sdk", () => ({
  sdk: {
    createSessionToken: mocks.createSessionToken,
  },
}));
vi.mock("./db", () => ({
  getUserByEmail: mocks.getUserByEmail,
  getUserByOpenId: mocks.getUserByOpenId,
  upsertUser: mocks.upsertUser,
  setUserPasswordHash: mocks.setUserPasswordHash,
}));

const OWNER_PASSWORD = "correct-horse-battery";
let ownerHash = "";

let server: Server | undefined;

beforeEach(async () => {
  vi.resetAllMocks();
  ownerHash = await hashPassword(OWNER_PASSWORD);
  mocks.createSessionToken.mockResolvedValue("isolated-test-session");
  mocks.upsertUser.mockResolvedValue(undefined);
  mocks.setUserPasswordHash.mockResolvedValue(undefined);
  mocks.getUserByEmail.mockResolvedValue(undefined);
  mocks.getUserByOpenId.mockResolvedValue(undefined);
});

afterEach(async () => {
  if (server) {
    const closing = server;
    server = undefined;
    closing.closeAllConnections();
    await new Promise<void>((resolve, reject) => {
      closing.close(error => (error ? reject(error) : resolve()));
    });
  }
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function loginUrl() {
  const app = express();
  app.use(express.json());
  registerAuthRoutes(app);
  server = createServer(app);
  await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/auth/login`;
}

async function attemptLogin(body: unknown) {
  return fetch(await loginUrl(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const adminUser = () => ({
  id: 1,
  openId: "owner",
  name: "Owner",
  email: "owner@example.com",
  loginMethod: "password",
  passwordHash: ownerHash,
  role: "admin" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
});

describe("owner dashboard entry", () => {
  it("puts the dashboard link above the main navigation, outside the mobile menu", () => {
    const html = renderToString(
      React.createElement(SiteLayout, { children: React.createElement("main") })
    );
    const topbar = html.split('<header class="site-header">')[0];
    expect(topbar).toMatch(
      /class="topline-owner" href="\/admin" rel="nofollow"/
    );
    expect(topbar).toContain("Owner dashboard");
    expect(topbar).not.toContain('id="main-navigation"');
  });

  it("uses the same clear dashboard label in the footer", () => {
    const html = renderToString(
      React.createElement(SiteLayout, { children: React.createElement("main") })
    );
    const footer = html.split('<footer class="site-footer">')[1];
    expect(footer).toContain(
      'href="/admin" rel="nofollow">Owner dashboard</a>'
    );
    expect(footer).not.toContain("Owner login");
  });

  it("explains the owner email and password sign-in when sign-in is needed", () => {
    const html = renderToString(
      React.createElement(OwnerAccessGate, {
        access: { state: "denied", status: 401 },
        retry: vi.fn(),
      })
    );
    expect(html).toContain("Continue to sign in");
    expect(html).toContain("owner email and password");
    expect(html).not.toContain("Manus");
  });

  it("does not send a permission-denied session through another sign-in loop", () => {
    const html = renderToString(
      React.createElement(OwnerAccessGate, {
        access: { state: "denied", status: 403 },
        retry: vi.fn(),
      })
    );
    expect(html).toContain("Owner access needs to be confirmed");
    expect(html).toContain("Check access again");
    expect(html).toContain("not signed in as the website");
    expect(html).not.toContain("Continue to sign in");
  });
});

describe("password sign-in", () => {
  it("issues the app session cookie for the owner with valid credentials", async () => {
    mocks.getUserByEmail.mockResolvedValue(adminUser());
    const response = await attemptLogin({
      email: "owner@example.com",
      password: OWNER_PASSWORD,
    });
    expect(response.status).toBe(200);
    const cookies = response.headers.get("set-cookie") ?? "";
    expect(cookies).toContain(`${COOKIE_NAME}=isolated-test-session`);
    expect(cookies).toContain("HttpOnly");
    expect(cookies).toContain("SameSite=Lax");
    expect(mocks.createSessionToken).toHaveBeenCalledWith(
      "owner",
      expect.objectContaining({ name: "Owner" })
    );
    expect(mocks.upsertUser).toHaveBeenCalledWith(
      expect.objectContaining({ openId: "owner" })
    );
    expect(mocks.upsertUser.mock.calls[0][0]).not.toHaveProperty("role");
  });

  it("rejects a wrong password without creating a session", async () => {
    mocks.getUserByEmail.mockResolvedValue(adminUser());
    const response = await attemptLogin({
      email: "owner@example.com",
      password: "not-the-password",
    });
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(mocks.createSessionToken).not.toHaveBeenCalled();
  });

  it("rejects an unknown email without creating a session", async () => {
    const response = await attemptLogin({
      email: "nobody@example.com",
      password: OWNER_PASSWORD,
    });
    expect(response.status).toBe(401);
    expect(mocks.createSessionToken).not.toHaveBeenCalled();
  });

  it("rejects a non-admin account even with a valid password", async () => {
    mocks.getUserByEmail.mockResolvedValue({ ...adminUser(), role: "user" });
    const response = await attemptLogin({
      email: "owner@example.com",
      password: OWNER_PASSWORD,
    });
    expect(response.status).toBe(403);
    expect(mocks.createSessionToken).not.toHaveBeenCalled();
  });

  it("rejects sign-ins missing required fields", async () => {
    const response = await attemptLogin({ email: "owner@example.com" });
    expect(response.status).toBe(400);
    expect(mocks.createSessionToken).not.toHaveBeenCalled();
  });

  it("bootstraps the owner account from the environment on first sign-in", async () => {
    vi.stubEnv("OWNER_EMAIL", "owner@example.com");
    vi.stubEnv("OWNER_PASSWORD", OWNER_PASSWORD);
    // The freshly created account has no stored hash yet; after the bootstrap
    // stores one, the re-read account carries it for verification.
    mocks.getUserByOpenId
      .mockResolvedValueOnce({ ...adminUser(), passwordHash: null })
      .mockResolvedValue(adminUser());
    const response = await attemptLogin({
      email: "owner@example.com",
      password: OWNER_PASSWORD,
    });
    expect(response.status).toBe(200);
    expect(mocks.upsertUser).toHaveBeenCalledWith(
      expect.objectContaining({ openId: "owner", role: "admin" })
    );
    expect(mocks.setUserPasswordHash).toHaveBeenCalledWith(
      "owner",
      expect.stringMatching(/^scrypt:/)
    );
    expect(mocks.createSessionToken).toHaveBeenCalled();
  });
});
