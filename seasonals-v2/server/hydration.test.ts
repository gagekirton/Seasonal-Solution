import React from "react";
import { renderToString } from "react-dom/server";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import viteConfig from "../vite.config";

let vite: ViteDevServer;
beforeAll(async () => {
  vite = await createServer({
    ...viteConfig,
    configFile: false,
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true, hmr: false },
  });
});
afterAll(async () => { await vite?.close(); });

describe("SSR and client instrumentation parity", () => {
  it("renders the painting page with the same editor location props as the browser module", async () => {
    const { default: App } = await vite.ssrLoadModule("/src/App.tsx");
    const html = renderToString(React.createElement(App, { path: "/services/painting" }));
    const client = await vite.transformRequest("/src/App.tsx");
    const marker = html.match(/data-loc="(client\/src\/App\.tsx:\d+)"/);
    expect(html).toContain("Interior &amp; Exterior Painting in Winnipeg");
    expect(marker).not.toBeNull();
    expect(client?.code).toContain(marker![1]);
  });

  it("restricts editor-only JSX attributes to development serve mode", () => {
    const plugins = (viteConfig.plugins ?? []).flat();
    const locationPlugin = plugins.find(plugin => plugin && typeof plugin === "object" && "name" in plugin && plugin.name === "vite-plugin-jsx-loc");
    expect(locationPlugin).toMatchObject({ apply: "serve" });
  });
});
