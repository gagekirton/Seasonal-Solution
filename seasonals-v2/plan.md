# Seasonal Solutions — implementation plan

## Product and implementation

Rebuild the existing website as a professional, accessible Winnipeg home-services site with useful public service pages and a working quote backend. Keep the initialized React, Express, tRPC, Drizzle and managed MySQL stack. Use `shared/site.ts` as the source of verified business facts, services, areas and routes; do not invent a business address, testimonials, credentials or completed jobs. Public service routes render useful initial HTML and route-specific SEO metadata. Private customer and lead routes render no customer details on the server and are protected by Manus OAuth plus the explicitly configured `OWNER_OPEN_ID` or an admin role.

Extend quote capture into a small private CRM. Generate an opaque random UUID for each customer server-side. Link repeat inquiries to one customer by normalized email and backfill existing leads through a reviewed additive migration; keep each quote-request row as its own record. Capture first landing path and optional UTM source, medium and campaign without persisting request IP addresses or full referrer URLs. Store explicit quote-contact consent separately from a new unchecked optional email-marketing opt-in; record timestamp, source and copy version, and any later opt-out. Never infer marketing consent from a quote, prior customer history, or the public business email.

Retain append-only consent events so a later affirmative reconsent does not erase prior opt-out evidence. Serialize seasonal task creation and reopening with opt-out changes; withdrawal cancels open seasonal tasks while retaining history. Customer latest-contact fields use millisecond timestamps and ordered updates so delayed older inquiries do not overwrite newer contact facts. Reject likely card numbers and explicitly labelled banking credentials in free-text input with a conservative server-side check; this is not a guarantee that arbitrary sensitive data can always be recognized.

Give each customer zero or more service jobs. Track requested/quoted amount, accepted/booked amount, status and dates separately from append-only recorded payment/refund entries. Define lifetime collected value as net recorded payments; define booked value from non-cancelled accepted jobs. Do not infer profit, payment, booked work or a predicted LTV from a quote alone. Add owner-managed follow-up tasks linked to customers and optionally to leads/jobs, with due date and open/completed/cancelled state. These tasks are internal reminders only: do not email, text or schedule automated outreach. Seasonal or promotional follow-up requires recorded opt-in; this system sends no marketing messages. Customer and revenue metrics use private authenticated endpoints and never enter public HTML, metadata or shared caches.

## Project structure

- `client/src/App.tsx`, `client/src/CrmPages.tsx`, `client/src/Brand.tsx`: public pages and quote form, protected lead inbox, customer search/profile, job/payment history and follow-up screens; all CRM content is fetched only after server authorization.
- `client/src/adminDownloads.ts`: authenticated, no-store CSV downloads that work with the site's Preview session mechanism.
- `client/src/index.css`, `client/index.html`, `client/public/`: responsive brand and CRM design, HTML shell, favicon, sitemap, robots policy and synchronized route manifest.
- `shared/site.ts`: verified business facts, service/area content, public/private route metadata and legacy redirects; `shared/crm.ts`: exact versioned marketing opt-in wording.
- `server/_core/index.ts`: validated quote submission, spam controls, lead inbox access and server startup; `server/crmRoutes.ts`: private CRM REST endpoint validation and per-request admin enforcement; `server/_core/adminAccess.ts`: shared fail-closed owner/admin policy.
- `server/db.ts`: existing Manus account and basic lead queries; `server/crmDb.ts`: transactional customer matching and lead insertion, backfill-compatible customer queries, service jobs, payment/refund ledger, follow-ups and measured value metrics; `server/crmDomain.ts` plus `server/crmDomain.test.ts`: customer IDs, email normalization, consent eligibility and net-payment calculations.
- `server/leadAccess.ts`, `server/leadAccess.test.ts`: existing explicit owner/admin rule and regression tests, including denial based on public contact email alone.
- `drizzle/schema.ts`, `drizzle/0002_parallel_jane_foster.sql` through `drizzle/0005_hard_wrecking_crew.sql`, `drizzle/meta/`: additive customer/job/payment/follow-up and consent-ledger tables, nullable customer/source fields on existing leads, task-ID width and timestamp precision; backfill existing inquiry relationships and prior consent evidence without deleting original data or assigning old marketing consent.
- `server/_core/vite.ts`, `server/seo.ts`: route-aware SSR, private `noindex` metadata, route-specific public metadata, accurate service-business structured data and real not-found behavior.
- `server/crmDb.test.ts`, `server/crmRoutes.test.ts`, `server/inputSafety.ts`, `server/inputSafety.test.ts`: isolated persistence/route regressions and conservative payment-credential validation. Tests never connect to the shared production database.
- `plan.md`, `TODO.md`, `CRM-RESEARCH.md`, `CRM-GUIDE.md`: approved design/architecture, full outcome criteria, saved consent-source notes and owner handoff instructions.

## CRM definitions and important constraints

The customer ID is a stable server-generated `cus_<UUID>`-style identifier, never an email or sequential database ID. Email matching is lowercase-and-trimmed; this may group people who intentionally share one email address, so the admin profile always shows the underlying contact email. Store monetary values as CAD decimals. Collected lifetime value is the sum of payment entries minus refunds; booked value is shown separately. Cost, gross profit, ad spend and predictive LTV are not measured because the website has no corresponding verified data.

Marketing opt-in is an optional, unchecked control with affirmative, versioned wording; the required project-response consent remains independent. Current CRTC guidance says commercial electronic messages require consent, sender identification and an unsubscribe mechanism, and that businesses should be able to prove consent. Therefore this CRM records consent and opt-out evidence and does not send campaigns or assume the quote form grants marketing permission. Source: [CRTC CASL guide](https://crtc.gc.ca/eng/com500/guide.htm) and [CRTC CASL FAQ](https://crtc.gc.ca/eng/com500/faq500.htm). This is a product safeguard, not legal advice.

## Design — Northern Field Journal

**Style exploration:** Northern Field Journal, an editorial field-notes approach to local home services (0.06); an airy Scandinavian service studio built around open white space (0.04); and a modern civic-utility system with crisp technical labels (0.02). Choose Northern Field Journal to make a practical local contractor feel established and personal without pretending to have credentials or a portfolio that was not supplied.

- **Design movement:** Northern Field Journal, blending the quiet order of architectural publications with the tactile annotation of a craftsman's job book.
- **Core principles:** clarity before decoration; honest local specificity; editorial hierarchy for fast scanning; and one unmistakable next action on every service page.
- **Color philosophy:** deep spruce communicates steadiness and a Manitoba landscape; limestone/cream supplies warmth and legibility; restrained amber marks calls to action and small field-note details. White is used for forms and records rather than a glossy all-white template.
- **Layout paradigm:** asymmetrical split hero, open side-aligned editorial sections, service cards that vary by content, and narrow inset detail panels. The private CRM keeps wider list-first panels for keyboard and mobile scanning instead of copying the public editorial arrangement.
- **Signature elements:** a custom roof/season mark in the wordmark; compact uppercase field-note labels with short gold rules; and fine ruled separators that organize service and customer histories.
- **Interaction philosophy:** direct phone/email and quote paths; visible focus states; native forms with server-validated feedback; no behavior that suggests sending or booking when the system only records an internal task.
- **Animation:** restrained button/card hover transitions and the existing short loading pulse only; no parallax, autoplay or scroll-driven movement. Respect `prefers-reduced-motion` by suppressing nonessential transitions and animation.
- **Typography system:** DM Sans for body, forms and compact labels; DM Serif Display for major editorial headlines and customer/service section titles. Use sentence case for reading copy and sparse uppercase for metadata labels.
- **Brand essence:** a plainspoken Winnipeg home-services partner for property owners who want practical upkeep and repairs without making the process feel complicated; **steady, capable, neighborly**.
- **Brand voice:** clear about scope and next steps, local but never stuffed with city-name keywords. Example lines: “Tell us what needs doing.” “A clear conversation about the scope comes first.”
- **Wordmark and logo:** the Seasonal Solutions wordmark pairs a custom geometric roof/season mark with the two-level brand name and a small Winnipeg/Manitoba location line; the matching SVG mark is also used as the favicon.
- **Signature brand color:** deep spruce (`--spruce-dark`), supported by warm limestone and a controlled amber accent.

## Owner dashboard extension (October 2026)

The owner gets one private dashboard at `/admin`, reusing the Manus OAuth owner/admin gate (`requireCrmAdministrator`) and the Northern Field Journal visual system. A shared `AdminShell` (sidebar on desktop, horizontal scroller on mobile) wraps Overview, Leads, Customers, Follow-ups, Content, Payments and Integrations. Admin modules are lazy-loaded so public visitors do not download private tools; their SSR output remains a non-indexed access shell.

**Stats.** A cookie-free first-party beacon (`POST /api/track`) aggregates public page views per Winnipeg day and path (`page_view_daily`) and landing-visit sources (`session_source_daily`: UTM source/medium, external referrer host, or direct). It stores no IP address, user agent or visitor identifier; bots, admin/pay paths and owner-flagged devices are skipped and requests are rate limited in memory. `GET /api/admin/dashboard?range=7|30|90|365` combines this with leads, customers, jobs, payments and follow-ups: KPIs with previous-period deltas, daily chart, pipeline counts, leads by service and source, top pages, revenue by month, a needs-response queue and integration status. Platform Umami/Plausible analytics remain enabled for the published site.

**Leads.** Lead status gains `quoted`, `won` and `lost` (existing `new`, `contacted`, `closed` retained) plus a private internal note. The inbox gains search, status/service filters, quick mark-contacted and customer links. Every saved quote triggers a compact owner notification; failures never block the submission.

**Content.** `posts` (draft/published; category tips/project/news; optional related service and area; Markdown body; cover image and alt; optional SEO title/description) and `media_assets` (uploaded image index). Owners upload JPEG/PNG/WebP images (≤8 MB, magic-byte checked) to project storage. Public `/blog` and `/blog/:slug` are server-rendered with BlogPosting JSON-LD, article Open Graph, real 404s for unknown/draft slugs, and a dynamic `/sitemap.xml` including published posts. Home, service and Our approach pages show related published posts only when they exist. Markdown renders via react-markdown + remark-gfm without raw HTML.

**SSR data.** `server/ssrData.ts` loads route data (posts, post, pay request) before rendering; it is passed to `App` as `data`, embedded as escaped JSON (`window.__SS_DATA__`) and reused during hydration.

**Stripe (platform-managed sandbox).** From a job, the owner creates a CAD payment request (≥ $0.50) yielding a durable private link `/pay/<random token>`. The pay page (noindex, no-store) shows business, description and amount; "Pay securely" creates a Checkout Session using Stripe-configured payment methods server-side using the browser origin (must equal the request `Origin` header), with `client_reference_id`, request/job/customer metadata, `customer_email` and `allow_promotion_codes`. `/api/stripe/webhook` verifies the raw body, deduplicates in `stripe_events`, and on `checkout.session.completed` or `payment_intent.succeeded` atomically marks the request paid and appends one `source = stripe` ledger payment (unique payment-intent ID), then alerts the owner and optionally pushes to QuickBooks. `payment_intent.payment_failed` stores a short failure note; other subscribed events are acknowledged. Refunds made in Stripe are recorded manually (refund events are not in the platform subscription). `/admin/payments` lists requests with status, amount, customer, copy link and cancel.

**QuickBooks Online.** Optional credentials `QUICKBOOKS_CLIENT_ID` / `QUICKBOOKS_CLIENT_SECRET`, requested only when the owner has an Intuit app (declared secrets are required for publishing). The owner picks sandbox or production, sees the exact redirect URI (`<origin>/api/integrations/quickbooks/callback`) to register with Intuit, and connects through Intuit authorization. A single-use, 10-minute, hashed `oauth_states` record created by an authenticated admin protects the callback (Preview cookies may be partitioned). Tokens are encrypted with AES-256-GCM using an HKDF key derived from the platform JWT secret; refresh is serialized with a row lock and `invalid_grant` marks the connection for reconnection. Actions: sync customer (create/link, duplicate-name fallback), create a job invoice (default Service item and optional tax code from the company's lists), push recorded payments applied to that invoice (manual or automatic, including Stripe). Links live in `accounting_links` keyed by realm; every action writes `sync_events`. Minor version 75 is sent on every call. Sources: `/home/ubuntu/seasonals-dashboard-research.md`.

**Review fixes in this pass.** 301 `/request-quote` → `/contact`; intent-first quote form with optional project type; skip link, `aria-current`, Escape-to-close mobile menu with focus return; darker muted text (≥4.5:1) and larger small text; lazy below-fold images with dimensions; font preconnect; compression, `Referrer-Policy`, `Permissions-Policy`, immutable caching for hashed assets, `public, max-age=0, must-revalidate` for public HTML (private/no-store for admin, pay and APIs); richer Organization JSON-LD (`@id`, logo, offer catalogue) and `og:image:alt`. Owner-dependent items (confirmed task list, real photos/reviews/GBP link, response-time promise, travel limits) are documented, not invented.

### Added project structure

| Path | Responsibility |
| --- | --- |
| `server/dashboardDb.ts`, `server/dashboardRoutes.ts` | Stats aggregation, dashboard and lead-triage APIs |
| `server/analytics.ts` | Beacon validation, bot filtering, daily aggregation |
| `server/contentDb.ts`, `server/contentRoutes.ts` | Posts CRUD, cached public queries, image upload |
| `server/ssrData.ts`, `server/sitemap.ts` | SSR route data and dynamic sitemap |
| `server/stripePayments.ts`, `server/stripeRoutes.ts` | Payment requests, Checkout, webhook fulfillment |
| `server/quickbooks.ts`, `server/quickbooksRoutes.ts`, `server/tokenCrypto.ts` | OAuth, encrypted tokens, API client, sync actions |
| `server/ownerAlerts.ts` | Owner notifications for leads and payments |
| `shared/content.ts` | Shared post types and constants |
| `client/src/Layout.tsx` | Public layout and SSR data context |
| `client/src/BlogPages.tsx`, `client/src/PayPage.tsx` | Public blog and payment pages |
| `client/src/admin/*` | AdminShell, Overview, Leads, Content, Payments, Integrations |

## Release refinements (November 2026)

Jobs now retain nullable first-acceptance `bookedAt` for date-period statistics without inventing historical acceptance dates. Current accepted-work totals exclude cancelled jobs and retain original acceptance on reopening. Manually recorded refunds select their original online/offline channel; balances and net channel reports reflect that choice. Manual received payments use the same post-commit optional QuickBooks path as verified Stripe receipts.

QuickBooks creates are serialized with local entity row locks and stable company/site/entity request IDs; conflicting remote links are not overwritten. Actions create/link once rather than refreshing existing records. Changes to taxes, invoice amounts and refunds need owner/bookkeeper review; there is no durable retry worker or two-way sync. Intuit credentials remain absent.

Content writes allowlist editable fields, bound UTF-8 body size and clarify that saving published edits makes them public immediately. Stripe uses one active Checkout Session per request, stable creation idempotency, cancellation expiration and actual collected amounts for confirmations. The private mobile navigation is labelled and its first grid row sized to content. Owner guide and prioritized review are committed alongside source. Publication is not authorized by this continuation and stays separate from saving.
