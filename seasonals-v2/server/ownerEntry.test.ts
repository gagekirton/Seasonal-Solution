import express from "express";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import React from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SiteLayout } from "../client/src/Layout";
import { OwnerAccessGate } from "../client/src/admin/AdminShell";
import {
  COOKIE_NAME,
  OAUTH_STATE_COOKIE,
  encodeOAuthState,
} from "../shared/const";
import { registerOAuthRoutes } from "./_core/oauth";

const mocks = vi.hoisted(() => ({
  exchangeCodeForToken: vi.fn(),
  getUserInfo: vi.fn(),
  createSessionToken: vi.fn(),
  upsertUser: vi.fn(),
}));

vi.mock("./_core/sdk", () => ({
  sdk: {
    exchangeCodeForToken: mocks.exchangeCodeForToken,
    getUserInfo: mocks.getUserInfo,
    createSessionToken: mocks.createSessionToken,
  },
}));
vi.mock("./db", () => ({ upsertUser: mocks.upsertUser }));

let server: Server | undefined;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.exchangeCodeForToken.mockResolvedValue({
    accessToken: "isolated-test-access",
  });
  mocks.getUserInfo.mockResolvedValue({
    openId: "isolated-test-user",
    name: "Test user",
  });
  mocks.createSessionToken.mockResolvedValue("isolated-test-session");
  mocks.upsertUser.mockResolvedValue(undefined);
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
  vi.restoreAllMocks();
});

async function callbackUrl() {
  const app = express();
  registerOAuthRoutes(app);
  server = createServer(app);
  await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/oauth/callback`;
}

const state = encodeOAuthState({
  redirectUri: "https://preview.example/api/oauth/callback",
  nonce: "test-browser-nonce",
});

async function completeCallback(
  cookie = `${OAUTH_STATE_COOKIE}=test-browser-nonce`
) {
  const url = new URL(await callbackUrl());
  url.searchParams.set("code", "isolated-test-code");
  url.searchParams.set("state", state);
  url.searchParams.set("returnTo", "https://untrusted.example/");
  return fetch(url, { redirect: "manual", headers: { Cookie: cookie } });
}

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

  it("explains the existing Manus account and optional Google method when sign-in is needed", () => {
    const html = renderToString(
      React.createElement(OwnerAccessGate, {
        access: { state: "denied", status: 401 },
        retry: vi.fn(),
      })
    );
    expect(html).toContain("Continue with Manus");
    expect(html).toContain("Google is optional");
    expect(html).toContain("same Manus account");
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
    expect(html).toContain(
      "Resetting a Google password will not grant dashboard access"
    );
    expect(html).not.toContain("Continue with Manus");
  });
});

describe("OAuth dashboard return", () => {
  it("returns a nonce-validated login to the fixed dashboard and keeps the secure app cookie", async () => {
    const response = await completeCallback();
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/admin");
    const cookies = response.headers.get("set-cookie") ?? "";
    expect(cookies).toContain(`${COOKIE_NAME}=isolated-test-session`);
    expect(cookies).toContain("HttpOnly");
    expect(cookies).toContain("Secure");
    expect(cookies).toContain("SameSite=None");
    expect(mocks.upsertUser).toHaveBeenCalledWith(
      expect.objectContaining({ openId: "isolated-test-user" })
    );
    expect(mocks.upsertUser.mock.calls[0][0]).not.toHaveProperty("role");
  });

  it.each(["", `${OAUTH_STATE_COOKIE}=wrong-nonce`])(
    "rejects a missing or mismatched browser nonce (%s)",
    async cookie => {
      const response = await completeCallback(cookie);
      expect(response.status).toBe(403);
      expect(response.headers.get("location")).toBeNull();
      expect(mocks.exchangeCodeForToken).not.toHaveBeenCalled();
      expect(mocks.upsertUser).not.toHaveBeenCalled();
      expect(mocks.createSessionToken).not.toHaveBeenCalled();
    }
  );

  it("rejects callbacks missing required parameters", async () => {
    const response = await fetch(await callbackUrl(), { redirect: "manual" });
    expect(response.status).toBe(400);
    expect(mocks.exchangeCodeForToken).not.toHaveBeenCalled();
  });

  it("does not create a session when the provider returns no identity", async () => {
    mocks.getUserInfo.mockResolvedValue({ name: "Test user" });
    const response = await completeCallback();
    expect(response.status).toBe(400);
    expect(mocks.upsertUser).not.toHaveBeenCalled();
    expect(mocks.createSessionToken).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBeNull();
  });

  it("does not redirect or create a session when the provider exchange fails", async () => {
    mocks.exchangeCodeForToken.mockRejectedValue(
      new Error("isolated test failure")
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await completeCallback();
    expect(response.status).toBe(500);
    expect(mocks.upsertUser).not.toHaveBeenCalled();
    expect(mocks.createSessionToken).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBeNull();
  });
});
