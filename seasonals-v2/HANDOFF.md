# HANDOFF: read this first

For any AI agent or developer continuing this project (Manus, Claude Code, others).
Greppable markers in code: search for `HANDOFF:` to find the notes left next to the code they describe.

## 1. What this is

Seasonal Solutions: a Winnipeg home-services business (handyman, landscaping and lawn care, painting, home renovations, seasonal maintenance). One owner, no staff accounts.

- **Public site**: server-rendered React pages that bring in quote requests.
- **Private owner dashboard** at `/admin`: leads, customers (CRM), follow-ups, blog, payments (Stripe), QuickBooks sync, traffic stats.

Success = the owner gets real quote requests, replies fast, gets paid, and never sees false claims about the business on the site.

## 2. Stack and commands

React + Vite + wouter (client) · Express (server, REST under `/api`) · tRPC only for `auth.*` and `system.*` · Drizzle + MySQL · Stripe Checkout (CAD) · QuickBooks Online · Manus platform (OAuth login, `/manus-storage/` files, owner notifications). Public CSS: `client/src/index.css`. Admin CSS: `client/src/dashboard.css` (custom, not Tailwind components).

```
pnpm install
pnpm dev            # dev server (PORT, default 3000)
pnpm check          # tsc --noEmit
pnpm test           # vitest (15 files, 102 tests after owner-entry fix)
pnpm build          # vite build + esbuild server
pnpm db:push        # drizzle-kit generate + migrate (schema changes)
```

**Definition of done for ANY change:** `pnpm check && pnpm test && pnpm build` all pass, and you say what you did and did not verify. Do not claim something works without running these.

## 3. Where things live

| Area | Files |
|---|---|
| Server entry, middleware order | `server/_core/index.ts` (the `/api/quote` handler is still inline here) |
| Auth gate, helpers, rate limiter | `server/http.ts` (`adminRoute`, `requireJson`, `asyncRoute`, `createRateLimiter`, `browserOrigin`) |
| Business facts, services, areas, page meta | `shared/site.ts` (single source of truth) |
| Consent wording + version | `shared/crm.ts` |
| Leads, customers, jobs, payments, follow-ups | `server/crmDb.ts`, `server/crmRoutes.ts`, `server/crmDomain.ts` |
| Stripe payment links and webhook | `server/stripePayments.ts`, `server/stripeRoutes.ts` |
| QuickBooks | `server/quickbooks.ts`, `server/quickbooksRoutes.ts`, `server/tokenCrypto.ts` |
| Blog and uploads | `server/contentDb.ts`, `server/contentRoutes.ts`, `shared/content.ts` |
| SEO, sitemap, server-side data | `server/seo.ts`, `server/sitemap.ts`, `server/ssrData.ts` |
| Traffic stats | `server/analytics.ts`, `client/src/tracking.ts` |
| Dashboard data | `server/dashboardDb.ts`, `server/dashboardRoutes.ts` |
| Owner alerts | `server/ownerAlerts.ts` |
| Schema | `drizzle/schema.ts` (migrations in `drizzle/`, generated) |
| Public pages | `client/src/App.tsx`, `BlogPages.tsx`, `PayPage.tsx` |
| Admin UI | `client/src/admin/*` (Overview, Leads, Content, Payments, Integrations) and `client/src/CrmPages.tsx` (Customers, Follow-ups) |

Admin routes to know: `/api/admin/me`, `/dashboard`, `/alerts`, `/logout`, `/leads`, `/crm/*`, `/posts`, `/media`, `/payments`, `/integrations/quickbooks`. Public: `/api/quote`, `/api/track`, `/api/pay/:token`, `/api/stripe/webhook`.

## 4. Key flows

1. **Quote**: form → `POST /api/quote` (honeypot, rate limit, zod, payment-card detector) → `createLeadWithCustomer` (one customer per normalized email, one lead per request) → owner alert.
2. **Payment**: owner creates a payment request on a job → customer opens `/pay/<token>` → Stripe Checkout → **webhook** records the payment in the `payments` ledger (idempotent via `stripe_events`) → owner alert → optional QuickBooks push. The browser redirect never marks anything paid.
3. **Admin access**: `Owner dashboard` in the public top bar or footer → `/admin` → Manus OAuth login → signed session cookie → fixed return to `/admin`. Every `/api/admin/*` route goes through `adminRoute`. Admin = `OWNER_OPEN_ID` or role `admin`; signing in alone never grants that role. HTTP 403 shows an access-confirmation message instead of another sign-in loop (tests: `server/ownerEntry.test.ts`).

## 5. Invariants: do NOT break these

1. Every admin endpoint uses `adminRoute`. Never gate admin access client-side only, and never derive admin rights from the public business email.
2. Private responses are `no-store`; admin pages are `noindex` and not in the sitemap.
3. Money: CAD only. Stripe amounts are integer cents. "Collected" = payments minus refunds. A quote or booked amount is never "revenue". Do not compute profit or LTV without verified inputs.
4. The Stripe webhook route is registered **before** `express.json()` (it needs the raw body), verifies the signature, and is idempotent. Do not mark payments from the success redirect.
5. Marketing consent is optional, unchecked by default, and separate from replying to a quote. `consent_events` is append-only. Changing consent copy means bumping `MARKETING_CONSENT_VERSION`. The public form may only fill blank fields on an existing customer and must never reverse a recorded opt-out (tests: `server/crmDb.test.ts`).
6. Never store card data or request IP addresses. Rate limiting is in-memory only.
7. QuickBooks tokens stay encrypted (`tokenCrypto.ts`) and are never logged. OAuth state is single-use and stored hashed.
8. **Never invent**: credentials, licences, insurance, reviews, ratings, years in business, guarantees, awards, addresses, gallery/work samples, or service areas. The hero image is labelled illustrative and must stay labelled until it is replaced by a real photo.
9. Public pages must render meaningful HTML on the server and match the client markup (`server/hydration.test.ts`). `serializePageData` escapes embedded JSON; keep it.
10. Business facts (phone, email, services, areas, titles, descriptions) are edited in `shared/site.ts` only. `client/public/manus-routes.json` duplicates titles and has drifted; update it or delete it.
11. Migrations are additive. Do not edit already-applied files in `drizzle/`; change `drizzle/schema.ts` and run `pnpm db:push`.
12. Admin code stays lazy-loaded so public visitors never download it (`client/src/main.tsx`).
13. Blog Markdown is rendered without raw HTML. Keep it that way.

## 6. Conventions

- **New admin API route**: validate with zod, wrap in `adminRoute("label", ...)`, call `requireJson` for mutations, return JSON errors via `PublicError`, add a test.
- **New admin page**: add to `NAV` and `AdminSection` in `admin/AdminShell.tsx`, wrap the page in `<AdminFrame current=... title=...>`, route it in `admin/AdminApp.tsx` (the whole admin bundle is already lazy-loaded from `main.tsx`), reuse existing classes in `dashboard.css`.
- **New service or area**: add to `shared/site.ts` only; pages, sitemap, SEO and nav derive from it. Write real scope; no filler.
- **Tests**: vitest. For database logic copy the mock-transaction pattern in `server/crmDb.test.ts`.
- **Formatting**: run `prettier --write` only on files you changed. Running it across `server/` or the whole repo reformats unrelated files and hides the real diff.
- **Copy**: plain, specific, first-person plural ("we"). No hedging language, no internal compliance notes on public pages, no unverifiable superlatives.
- **Dependencies**: prefer none. Ask before adding any. The `pnpm.overrides` in `package.json` force patched transitive versions; leave them.

## 7. Platform facts

- Env vars: `DATABASE_URL`, `MANUS_JWT_SECRET`, `MANUS_API_URL`, `MANUS_API_KEY`, `MANUS_OAUTH_API_URL`, `MANUS_PROJECT_ID`, `OWNER_OPEN_ID`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `QUICKBOOKS_CLIENT_ID`, `QUICKBOOKS_CLIENT_SECRET`.
- Uploads go to Manus storage and are served from `/manus-storage/...`. Cover images are validated to that prefix. Leaving Manus means replacing storage, login and every image URL.
- Session cookie is `SameSite=None` (needed for the preview iframe); sessions last a year. See NEXT-TASKS T4.
- `SITE_ORIGIN` (`shared/site.ts`) reads the server environment variable `SITE_ORIGIN`, with `https://www.seasonalsolutions.online` as fallback; whitespace and trailing slashes are removed. Set it to the intended public origin before starting the server. Canonical URLs, structured data, sitemap, robots and the social image derive from it, never from the request Host. `robots.txt` is now served by `server/sitemap.ts`; the static file was removed. T1 is complete in the separate v2 folder; deployment configuration has not been changed.

## 8. Needs the owner (code cannot fix)

Confirmed list of jobs actually offered · which communities are truly served · real before/after photos (strip location metadata first) · Google Business Profile link and real reviews · insurance/WCB statement if true · a domain email instead of the Hotmail address · final domain · GST/PST handling with the bookkeeper (QuickBooks invoices vs Stripe amounts).

## 9. Habits that produce bad results here

Rewriting whole files or regenerating from the template · "improving" payment, consent or auth code without tests · removing a safeguard to make a feature work · reformatting unrelated files · adding libraries casually · inventing business facts to fill a page · reporting success without running the checks · changing several unrelated things in one pass.
