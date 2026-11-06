# Seasonal Solutions owner dashboard guide

## Access the dashboard

In the rebuilt site's Preview, choose **Owner login** in the footer or open the `/admin` page using Preview's route selector. Sign in with the Manus account matching the configured owner identity. The dashboard provides Overview, Leads, Customers, Follow-ups, Content, Payments and Integrations. Navigation is labelled and horizontally scrollable on mobile.

Every private API checks the configured owner OpenID or an explicitly granted administrator role. The public business email is not an administrator credential. Signing in with another account will not reveal records. If the intended owner is denied, correct the protected `OWNER_OPEN_ID` configuration rather than sharing a login or removing the access check. Private pages are noindex; initial HTML contains no customer records and private API responses are not cached.

The dashboard is implemented in Preview, not deployed to the existing business domain. A successful owner browser sign-in has not yet been exercised in this validation.

## Daily lead and customer workflow

Start with **Overview → Needs a response**. In **Leads**, search inquiries, filter by service or stage, mark a request contacted and retain useful private notes. Stages are New, Contacted, Quoted, Won, Lost and Closed. A new saved quote triggers a non-blocking notification to the project owner; this is not a customer email or a guarantee of notification delivery.

Every inquiry is retained separately. The backend creates an opaque `cus_<UUID>` customer ID and links repeat inquiries by trimmed, lowercased email. Customer IDs contain no personal information. Shared email addresses may share a profile; different emails are not automatically merged. Customer profiles show contact history, inquiries, jobs, money received/refunded, consent evidence and internal follow-ups. Older delayed submissions cannot overwrite newer contact details.

From a profile, create a job after discussing scope. Keep quote amounts separate from accepted amounts and record the schedule and current status. An inquiry or quote is not money collected. Mark completed work completed, then record the payment or use its job shortcut to create a Stripe request. Do not manually record a Stripe receipt already added by a verified webhook.

## Understand the numbers

**Overview** compares 7, 30, 90 or 365 Winnipeg-calendar-day ranges against the preceding equal-length period. It shows public page views, landing visits, quote requests, new customer profiles, booked jobs/value, net collections, pipeline and follow-up queues, traffic sources, top pages and monthly collections. Today is a partial day, so comparisons against a complete prior period need care.

Visits are approximate browser-session landings, not unique people or advertising-platform sessions. Browser storage restrictions, blockers and bot filtering can affect counts. Conversion is quote requests divided by recorded visits; it is not a cross-device attribution model. Campaign labels are supplied UTM values and do not establish advertising causality. Use the Overview device-exclusion control on your own browsers; admin/payment pages are excluded automatically. Aggregate first-party stats do not retain IP addresses, user agents or visitor IDs, although the anti-spam limiter temporarily uses network information in memory.

Booked value includes currently booked, in-progress or completed jobs with recorded accepted amounts. Period booking statistics use the first acceptance timestamp, not the date a quote was created. Cancelling a job excludes it from current accepted-work totals; reopening preserves its first acceptance date. Historical jobs without a recorded acceptance time are not assigned an invented booking date and will not appear in date-specific booking statistics.

Collected value is actual recorded CAD receipts minus recorded refunds. Lifetime collected value sums that history for the customer; it is measured past value, not predicted future LTV, profit or cash in a bank account. A repeat customer has at least two completed jobs. Taxes, material costs, Stripe fees and advertising spend are not calculated in CRM value metrics.

The manual ledger records money already received or refunded. For a refund, choose the original **Offline** or **Stripe** channel so online/offline net reporting remains accurate. A refund cannot exceed the job's net recorded balance for that channel. This control does not issue a refund or move money. Never enter card numbers, security codes or bank credentials in CRM text; validation rejects likely credentials but cannot identify every sensitive-data format.

## Publish tips, project notes and news

Open **Content → New post**. Add a factual title, optional web-address slug, category, excerpt, Markdown body and optional related service/area. Upload a JPEG, PNG or WebP cover up to 8 MB and supply descriptive alt text. Optional SEO title and description customize the article's search presentation. Article size is limited to 50,000 characters and MySQL TEXT's UTF-8 byte capacity; heavily multibyte text may reach the byte limit sooner.

Use **Preview** to inspect the Markdown locally, then save and publish deliberately. Drafts are not public. Published articles appear at `/blog/<slug>`, in the article sitemap and relevant site feeds, with server-rendered content and article metadata. Raw HTML is not rendered from Markdown.

Saving changes to an already-published article updates it immediately. Unpublish first to work privately. Changing a published slug changes its URL; there is no automatic historical-slug redirect, so avoid changing a URL that customers or search engines already use. Deleting removes the article. Use real, permission-approved project photos and customer facts; do not publish invented projects, ratings or credentials.

## Stripe payment requests

From a job, use **Create payment link** or open **Payments**. Enter a job ID, description and CAD amount of at least $0.50. Copy the resulting private payment link and send it to the customer through your normal channel. Treat the link as confidential: anyone holding it can view its limited project/payment details.

Stripe hosts checkout; this site does not collect or store card details. Repeated attempts reuse the active Checkout Session. A completed session waiting for its webhook cannot open another checkout. Cancelling an open request expires its active Stripe session; a completed checkout cannot be hidden by cancellation. Some payment methods may take time to confirm. The return page's success parameter is not payment evidence: only signed webhook fulfillment marks a request paid and adds its receipt once. Promotions reduce the actual collected amount, and paid-page confirmation uses that actual receipt.

The platform Stripe sandbox is enabled, its test webhook points at this Preview, and the account is unclaimed. Claim it through Manus project **Settings → Integrations**. For end-to-end testing, create a clearly labelled test customer/job/request and pay in Stripe's hosted sandbox checkout with test card `4242 4242 4242 4242`, a future expiry and any valid three-digit test CVC. Test business records would persist in the shared managed database, so they have deliberately not been inserted during this verification.

Live payments are not enabled or verified. After publication, supply the live key pair through project Settings → Integrations and republish as directed. Refunds must be issued in Stripe, then recorded in CRM on the Stripe channel; the managed webhook subscription does not deliver refund events. Reconcile Stripe and CRM before relying on collections totals.

## QuickBooks Online setup and boundaries

The integration code and dashboard are ready, but no Intuit app credentials or company authorization are configured. Use an Intuit developer app, select the matching sandbox or production credentials and provide `QUICKBOOKS_CLIENT_ID` and `QUICKBOOKS_CLIENT_SECRET` through protected project-secret input, never public content or browser fields. Register the exact origin plus `/api/integrations/quickbooks/callback` in Intuit. The Integrations page displays the full callback when credentials are configured; Preview and production need their respective registered URLs.

Connect your company, then choose the correct QuickBooks service item and optional tax code. Start with an Intuit sandbox company. Sync the CRM customer, create/link the job's invoice, then push a recorded payment against that invoice. Automatic payment push is opt-in and requires an existing invoice link; it applies to newly committed manual receipts and verified Stripe receipts. Skipped or failed actions appear in the activity log where recorded; review and retry them manually. There is no durable background retry worker.

Creates are serialized per local entity and use stable, company-scoped Intuit request IDs. Existing links are returned rather than duplicated or silently overwritten. OAuth state is expiring/single-use and tokens are encrypted and refreshed with a database lock. None of this substitutes for a real authorized accounting test.

This is **create/link-only**, not two-way synchronization. Later changes to customer details, invoices, taxes, refunds, deletions and reconciliation need review in QuickBooks. Invoice creation uses the job amount and selected item/tax configuration; it is not a tax calculation or assurance of invoice accuracy. Payments go to QuickBooks' default deposit handling. Compare totals and permissions with your bookkeeper before production use; syncing does not email an invoice to a customer.

## Retention and consent

Create a dated quote-response, service-care or seasonal reminder rather than relying on memory. Follow-ups can be filtered to open, overdue, completed, cancelled or all. Seasonal/promotional tasks require current recorded marketing opt-in. Withdrawal cancels open seasonal tasks, and reopening needs current permission. The CRM retains append-only opt-in/opt-out evidence rather than erasing past withdrawal.

The public quote form keeps required project-contact consent separate from an optional, unchecked marketing opt-in. Customer campaigns, emails and SMS are not sent or scheduled. Before adding sending, verify a real sender/mailing address, unsubscribe handling and applicable Canadian rules. Consent recording is not a legal-compliance guarantee.

## Release and data limits

The additive migrations preserve existing inquiries and are applied to the database shared by Preview and publication. This does not import leads from the former externally hosted website. Customer/profile lists and exports have finite limits: customer search up to 200 profiles, history sections up to 200 entries, customer CSV up to 500 profiles and lead CSV up to 1,000 inquiries. These are operational exports, not full backups; protect downloaded personal data.

Automated checks use isolated doubles for writes. No valid test inquiry, customer job, payment or published article was added to the shared database. Type checks, isolated tests and the production build are verified for the release. Owner sign-in, sandbox Checkout/webhook delivery and QuickBooks authorization/create/replay still need owner-led end-to-end checks. Publication and existing-domain cutover are separate from saving this source version.
