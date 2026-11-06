import express, { type Express, type Request, type Response } from "express";
import fs from "fs";
import { type Server } from "http";
import path from "path";
import React from "react";
import { renderToString } from "react-dom/server";
import App from "../../client/src/App";
import { BLOG_POST_PATH, PAY_PATH, type PageData } from "../../shared/content";
import {
  LEGACY_REDIRECTS,
  isAdminPath,
  isKnownPage,
  normalizePath,
} from "../../shared/site";
import { buildSeoHead } from "../seo";
import { loadPageData, serializePageData } from "../ssrData";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

type PageComponent = React.ComponentType<{ path?: string; data?: PageData }>;

type RenderedPage = { html: string; status: number; isPrivate: boolean };

async function renderPage(
  template: string,
  rawPath: string,
  pageComponent: PageComponent = App
): Promise<RenderedPage> {
  const pathname = normalizePath(rawPath);
  const dynamic = BLOG_POST_PATH.test(pathname) || PAY_PATH.test(pathname);
  const { data, missing } = await loadPageData(pathname);
  const status = dynamic
    ? missing
      ? 404
      : 200
    : pathname === "/404" || !isKnownPage(pathname)
      ? 404
      : 200;
  const isPrivate = isAdminPath(pathname) || PAY_PATH.test(pathname);
  const head = [
    buildSeoHead(status === 404 ? "/404" : pathname, data),
    `<script>window.__SS_DATA__=${serializePageData(data)}</script>`,
  ].join("\n    ");
  const html = template.replace(/<title>[\s\S]*?<\/title>/i, "");
  const withHead = html.includes("<!--seo-head-->")
    ? html.replace("<!--seo-head-->", head)
    : html.replace("</head>", `${head}\n</head>`);
  const content = renderToString(
    React.createElement(pageComponent, { path: pathname, data })
  );
  return {
    html: withHead.replace("<!--ssr-outlet-->", content),
    status,
    isPrivate,
  };
}

function setPageHeaders(res: Response, page: RenderedPage) {
  res.status(page.status).set({
    "Content-Type": "text/html; charset=utf-8",
    // Public marketing pages may be revalidated by shared caches; private
    // dashboards and customer payment pages must never be stored.
    "Cache-Control": page.isPrivate ? "private, no-store" : "public, max-age=0",
    "X-Content-Type-Options": "nosniff",
    ...(page.isPrivate ? { "X-Robots-Tag": "noindex, nofollow" } : {}),
  });
}

function addRedirects(app: Express) {
  for (const [from, to] of Object.entries(LEGACY_REDIRECTS)) {
    app.get(from, (req: Request, res) => {
      const query = req.originalUrl.includes("?")
        ? req.originalUrl.slice(req.originalUrl.indexOf("?"))
        : "";
      const [target, hash] = to.split("#");
      res.redirect(301, `${target}${query}${hash ? `#${hash}` : ""}`);
    });
  }
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };
  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });
  app.use(vite.middlewares);
  addRedirects(app);
  app.get("/api/*", (_req, res) =>
    res.status(404).json({ error: "API route not found." })
  );
  app.get("*", async (req, res, next) => {
    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );
      const template = await fs.promises.readFile(clientTemplate, "utf-8");
      // Use the same JSX/plugin pipeline as browser modules. Loading App directly
      // with tsx omits Vite's data-loc props and causes hydration mismatches.
      const pageModule = await vite.ssrLoadModule("/src/App.tsx");
      const page = await renderPage(template, req.path, pageModule.default);
      const transformed = await vite.transformIndexHtml(
        req.originalUrl,
        page.html
      );
      setPageHeaders(res, page);
      res.end(transformed);
    } catch (error) {
      vite.ssrFixStacktrace(error as Error);
      next(error);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app.use(
    express.static(distPath, {
      index: false,
      setHeaders(res, filePath) {
        if (filePath.includes(`${path.sep}assets${path.sep}`))
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      },
    })
  );
  addRedirects(app);
  app.get("/api/*", (_req, res) =>
    res.status(404).json({ error: "API route not found." })
  );
  let template: string | null = null;
  app.get("*", async (req, res) => {
    try {
      template ??= await fs.promises.readFile(
        path.resolve(distPath, "index.html"),
        "utf-8"
      );
      const page = await renderPage(template, req.path);
      setPageHeaders(res, page);
      res.end(page.html);
    } catch (error) {
      console.error(
        "[SEO] Production page render failed:",
        error instanceof Error ? error.message : "unknown error"
      );
      res
        .status(500)
        .type("text/plain")
        .send("The page could not be rendered.");
    }
  });
}
