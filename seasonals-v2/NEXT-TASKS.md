# NEXT TASKS (in priority order)

Do one task per session. Start each with: "Read HANDOFF.md first. Then:" followed by the prompt. Every task is done only when `pnpm check && pnpm test && pnpm build` pass and you report what you did and did not verify.

## T1. Make the site origin configurable
**Why:** canonical URLs, `og:url`, sitemap, structured data and robots all point at `https://www.seasonalsolutions.online`, which is not live yet. Preview and staging URLs advertise the wrong canonical and a broken social image.
**Where:** `shared/site.ts` (`SITE_ORIGIN`), `server/seo.ts` (also the hardcoded `SOCIAL_IMAGE`), `server/sitemap.ts`, `client/public/robots.txt`.
**Prompt:** Make `SITE_ORIGIN` come from an env var `SITE_ORIGIN` with the current value as fallback. Serve `robots.txt` dynamically so its Sitemap line uses it, and build the social image URL from it. Do not change any page copy.
**Done when:** with `SITE_ORIGIN=https://example.test`, canonical, `og:url`, sitemap and robots all use it; add a test for `buildSeoHead` and `buildSitemap`.
**Status:** Completed 2026-11-05 in the separate v2 working folder. `pnpm check && pnpm test && pnpm build` pass (92 tests). No GitHub transfer or production deployment; configure the intended `SITE_ORIGIN` before deployment. T2 is next, not started.

## T2. Stop indexing empty pages
**Why:** `/blog` (no posts yet) and `/our-work` (no work to show) are in the sitemap as thin pages.
**Where:** `shared/site.ts` (`INDEXABLE_PATHS`), `server/sitemap.ts`, `server/seo.ts`, `server/ssrData.ts`.
**Prompt:** Mark `/blog` noindex and drop it from the sitemap while there are zero published posts, and do the same for `/our-work` until a flag in `shared/site.ts` says real work samples exist. Do not delete the pages.
**Done when:** page source shows `noindex` for both; the sitemap omits them; publishing a first post flips `/blog` to indexable; tests cover both states.

## T3. Restrict checkout redirect origins
**Why:** `browserOrigin` in `server/http.ts` accepts any HTTPS origin the browser sends, and the first one is baked into a reused Stripe session.
**Where:** `server/http.ts`, `server/stripeRoutes.ts`.
**Prompt:** Allow only `SITE_ORIGIN`, localhost for development, and origins listed in a new env var `ALLOWED_ORIGINS`. Reject others with a clear error. Add tests.
**Done when:** unknown origins are rejected; payments still work on the live domain and on the Manus preview host when it is listed. Ask the owner which preview hosts to allow.

## T4. Harden sessions (do on a branch; test real login)
**Why:** the session cookie is `SameSite=None` and valid for a year with no server-side revocation. The admin CSRF guard fails open when `Sec-Fetch-Site` is missing.
**Where:** `server/_core/cookies.ts`, `server/_core/sdk.ts`, `server/_core/index.ts` (`/api/admin` guard).
**Prompt:** Use `SameSite=Lax` in production, shorten the session to 30 days, and reject non-GET `/api/admin` requests whose `Origin` is present and not our own. Keep the preview working or document what breaks.
**Done when:** the owner can log in and out on the real domain and the Manus preview; cross-site form posts to admin endpoints are rejected. Do not merge untested.

## T5. Strip photo metadata on upload
**Why:** phone photos carry GPS coordinates. Uploads only check the file signature, so publishing real job photos could reveal customers' addresses.
**Where:** `server/contentRoutes.ts` (`/api/admin/media`), `server/storage.ts`.
**Prompt:** Re-encode uploaded images server-side so EXIF/GPS data is removed before storage. Ask me before adding an image library, and check it works on the Manus runtime.
**Done when:** a test image with GPS tags comes back from storage with none.

## T6. Save dashboard goals in the database
**Why:** Overview goals live in browser `localStorage`, so they do not follow the owner across devices.
**Where:** `client/src/admin/OverviewPage.tsx` (`GoalsPanel`), `drizzle/schema.ts`, `server/dashboardRoutes.ts`.
**Prompt:** Add a small additive `business_goals` table and `GET/PUT /api/admin/goals` (owner only, zod-validated). Keep the localStorage value as an offline fallback and migrate it on first save.
**Done when:** goals persist across browsers; tests cover validation and access control.

## T7. Admin dark mode
**Why:** the reference dashboard has a theme toggle. `dashboard.css` uses about 40 hardcoded colours, so a toggle alone would leave unreadable text.
**Where:** `client/src/dashboard.css`, `client/src/admin/AdminShell.tsx`.
**Prompt:** First convert every hardcoded colour in `dashboard.css` into named variables on `.dash` with no visual change in light mode. Then add a dark set and a toggle stored in `localStorage`. Check every admin page in both modes.
**Done when:** screenshots of all seven admin pages in both modes are readable; light mode is pixel-identical to before.

## T8. Modularise (low risk, mechanical)
**Prompt:** (a) Split `shared/site.ts` into business config, one data file per service, and page metadata. (b) Move the `/api/quote` handler and schema out of `server/_core/index.ts` into `server/quoteRoutes.ts`. (c) Collapse the duplicated helpers: `asyncRoute` (3 copies), the rate limiter (2), `requireJson` (2), `serviceLabel` (4), `privateRoute` vs `adminRoute`. (d) Split `client/src/App.tsx` into per-page files under a new `client/src/site/` folder (`client/src/pages/` holds unused template pages); move `CrmPages.tsx` into `admin/`. (e) Split `server/quickbooks.ts` into OAuth, client and sync parts.
**Done when:** no behaviour change; tests unchanged and green; one concern per commit/step.

## T9. Public performance
**Prompt:** The public bundle includes the tRPC client, react-query and superjson that no public page uses, plus react-markdown on every page. Remove or lazy-load them, self-host the Google Fonts, and inline `/api/platform/config.js` into the HTML. Report bundle sizes before and after.

## T10. Privacy and data rights
**Prompt:** Add owner-only delete and export for one customer, a stated retention period, and update the privacy page: leads are sent through the platform's owner-notification service, and fonts load from Google unless self-hosted (T9). Do not delete payment ledger rows that accounting needs; anonymise instead.

## T11. Real content (needs the owner)
Blocked until the owner supplies the items in HANDOFF.md section 8. Then: rewrite service pages with specific scope, what is and is not included, process, pricing factors and FAQs; replace the illustrative hero; link the Google Business Profile; show real reviews only with permission. Do not invent any of it.

## T12. Hygiene
Delete unused template leftovers (`ComponentShowcase.tsx`, `AIChatBox.tsx`, `DashboardLayout.tsx`, `Map.tsx`, `ManusDialog.tsx`, unused helpers in `server/_core/`, `vite.config.ts.bak`, the dead lead functions in `server/db.ts`). Stop shipping `client/public/manus-routes.json` and `client/public/__manus__/debug-collector.js`, or reconcile them with `shared/site.ts`. Re-run `pnpm audit --prod` and fix what remains.

## Product decisions waiting on the owner
Should a customer who opted out be able to opt back in through the form? Today they cannot (the opt-out stays until the owner decides). The proper fix is an email confirmation (double opt-in); decide before building it.
