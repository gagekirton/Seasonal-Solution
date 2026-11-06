# Seasonal Solutions: site review and next improvements

The rebuilt site now has a professional public experience and one private owner dashboard for lead triage, customer history, content, statistics, payment requests and accounting setup. The remaining local-growth constraint is not another visual redesign: it is more specific, verified service information and genuine evidence of completed local work. No local ranking, lead-volume or customer-LTV increase is guaranteed by this build.

## Refinements implemented

**Conversion and accessibility.** The quote form asks about service/project intent before contact details. Phone remains optional, service links preselect the appropriate category, and project-contact consent stays separate from optional marketing consent. `/request-quote` redirects to the canonical `/contact` route. The public layout adds a skip link, current-page navigation and Escape-to-close mobile navigation with focus return. Supporting text is darker and more legible. The private mobile dashboard now uses visible labels and avoids the oversized empty sidebar seen in review.

**Search and content delivery.** Public pages deliver meaningful server-rendered content, distinct titles/descriptions, canonical links and accurate structured data. Article publishing adds a server-rendered blog and related-content feeds; drafts/unknown article slugs are not public pages. The sitemap contains canonical public routes and published articles, not customer payment links or admin screens. Organization/service markup avoids a fabricated street address, review score, insurance or licence claim. Illustrative imagery remains clearly disclosed as not completed Seasonal Solutions work.

**Performance and page reliability.** Below-fold images load lazily with dimensions; font loading has preconnections. Public visitors do not load the private dashboard app until an admin route is opened. Responses support compression and hashed-asset caching while private data uses no-store. Shared SSR/client page data and development JSX instrumentation address the previously reported painting-page hydration mismatch.

**Owner operations.** Overview combines traffic, quote requests, a needs-response queue, current pipeline, jobs, net collections and follow-ups. Leads have search, service/stage filters and private notes. Customer IDs link repeat inquiries without embedding personal information. Job/payment history, current permission and append-only consent evidence support informed repeat-business follow-up. New inquiry and verified-payment alerts are non-blocking owner notifications, not customer campaigns.

**Accounting and publishing safeguards.** The review found and corrected an edited-post payload that could fail strict API validation, excessive multibyte article size, Winnipeg day-boundary assumptions, quote-creation dates incorrectly used for booking periods, and online refunds being attributed to offline collections. Stripe reuses active checkout sessions, expires cancelled sessions and confirms actual collected amounts through a signed, deduplicated webhook. QuickBooks create actions use local serialization and stable remote retry IDs; conflicting links are not silently replaced. Both new manual and verified online receipts can use opt-in accounting push after an invoice link exists.

## Highest-priority owner inputs

### 1. Confirm the actual task-level service catalogue

The current service pages accurately cover broad handyman, landscaping/lawn care, painting, renovations and seasonal-maintenance categories. They do not establish detailed scope for every adjacent query. Confirm which specific jobs the business accepts, exclusions, seasonal constraints and licensed-trade boundaries before expanding content.

Then add useful sections or focused pages only for real offerings. Each should explain the problem addressed, typical project scope, photos/details needed for a quote, preparation, pricing factors and relevant FAQs. Drywall, deck/fence work, eavestrough cleaning or snow removal should not appear as offered services without explicit confirmation. Do not create copy-swapped neighbourhood doorway pages.

### 2. Replace illustrative proof with real Winnipeg work

Supply permission-approved before/after photos with the job type and factual captions. Approximate neighbourhood context can help if the customer permits it; avoid exact customer addresses or identifiable details. Publish these as project notes through Content and use the best approved images on the public pages.

Provide the genuine Google Business Profile URL and authentic customer reviews with source/permission. Confirm any insurance or licence wording before adding it. The site does not fabricate credentials, testimonials, project photos or star ratings to fill the gap.

### 3. Confirm service boundaries and a sustainable response expectation

Verify which nearby communities are genuinely served, travel considerations and seasonal availability. Add useful coverage notes to the existing area hub rather than thin location clones. Confirm whether residential/commercial classification matters to the daily workflow.

Choose a response target only if it can be consistently met. Pair it with a clear next step—what happens after the inquiry and which details are needed—rather than promising an unverified response time or availability.

## Priorities before accepting live payments or syncing books

Open `/admin` in Preview and verify sign-in with the intended owner's Manus account. A configured identity and passing access-denial tests do not prove the owner's browser login works. Use another account only to confirm that access remains denied.

Claim the managed Stripe sandbox in project Settings → Integrations and run a labelled end-to-end test. Check payment-request state, Checkout, webhook delivery, the single receipt and confirmation amount. Live payment keys and publication are separate tasks. Refund events are not delivered by the platform's current subscription, so reconcile refunds manually.

Provide the Intuit developer credentials through protected input, register the exact callback and authorize a sandbox company before using production books. Verify the chosen item, taxes, invoice total, deposit handling and received-payment application with a bookkeeper. The current integration creates or links records; it does not refresh changed invoices, synchronize books bidirectionally or provide automatic durable retries.

## Use the dashboard to improve retention deliberately

Review uncontacted inquiries and overdue reminders each working day. Move stages only when the action actually occurred. Add jobs after agreement, distinguish accepted work from money received, and record completion/collections consistently. Use returning-customer history and service-care tasks to identify appropriate repeat work; do not treat every old inquiry as marketing permission.

Use traffic and service/source charts as directional measures, not advertising-platform attribution. Landing visits are approximate browser sessions; partial days, blockers, bot filtering and owner device-exclusion affect comparisons. No costs or margins are collected, so lifetime collected value is not profit or a prediction of future LTV.

## What remains unverified

The implementation is available in Preview. Code/build checks and isolated tests do not replace owner sign-in, actual sandbox payment/webhook delivery or an authorized QuickBooks company test. No valid test customer/payment/post was inserted into the shared database during this verification. The existing website domain has not been replaced; publication and domain cutover still need completion.

The detailed operating instructions and account-setup sequence are in `CRM-GUIDE.md` alongside the project source.
