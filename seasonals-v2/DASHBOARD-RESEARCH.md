# Dashboard integration research notes (gathered 2026-10-28)

## QuickBooks Online (Intuit)
- Discovery doc (production): https://developer.api.intuit.com/.well-known/openid_configuration
  - authorization_endpoint: https://appcenter.intuit.com/connect/oauth2
  - token_endpoint: https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer
  - revocation_endpoint: https://developer.api.intuit.com/v2/oauth2/tokens/revoke
  - token_endpoint_auth_methods: client_secret_post, client_secret_basic; response_types: code
- Accounting scope: com.intuit.quickbooks.accounting (callback returns code, state, realmId).
- Invoice API: https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/invoice
  - POST /v3/company/<realmID>/invoice ; Production base https://quickbooks.api.intuit.com ; Sandbox base https://sandbox-quickbooks.api.intuit.com
  - Minimum: CustomerRef.value + at least one Line, e.g. {"DetailType":"SalesItemLineDetail","Amount":100.0,"SalesItemLineDetail":{"ItemRef":{"value":"1"}}}
  - CurrencyRef required only if multicurrency enabled.
- Refresh tokens: rolling ~100-day validity; value can change on refresh (store the newest). Intuit blog (Nov 12, 2025) https://blogs.intuit.com/2025/11/12/important-changes-to-refresh-token-policy : all refresh tokens now have a maximum validity of five years (hard expiry); response includes x_refresh_token_expires_in. Help: https://help.developer.intuit.com/s/article/Validity-of-Refresh-Token
- Access token lifetime ~1 hour (expires_in in token response).
- Intuit App Partner Program available in US, UK, AU, Canada (excluding Quebec) (from developer.intuit.com footer).

## Manus platform facts (skills)
- Stripe: enable via webdev.config POST integrations/stripe/enable; platform supplies STRIPE_SECRET_KEY, VITE_STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET; webhook POST /api/stripe/webhook with fixed events: payment_intent.succeeded, payment_intent.payment_failed, customer.subscription.created/updated/deleted, checkout.session.completed. Verify signature on raw bytes; dedupe event IDs; success_url/cancel_url from browser origin; allow_promotion_codes true; test card 4242 4242 4242 4242; owner claims sandbox in Settings > Integrations; live keys added after publish.
- Open secure-input card blocks Stripe enable (secret_input_in_progress) -> enable Stripe before requesting QuickBooks credentials.
- Every declared secret is required for publish (required_secret_missing) -> only declare QuickBooks secrets when the owner has them.
- Gateway serves /sitemap.xml and /robots.txt preferring the project's document (server before storage); x-manus-seo-source header.
- Owner notification: POST $MANUS_API_URL/webdevtoken.v1.WebDevService/SendNotification {title<=1200, content<=20000}; helper server/_core/notification.ts notifyOwner().
- Storage: server/storage.ts storagePut(key, bytes, contentType) -> /manus-storage/<key>; validate admin + size before upload; index uploads in DB.
- Public origin: use window.location.origin passed from frontend for redirects; never internal Host.

## Additional QuickBooks facts
- Since August 1, 2025, Accounting API minor versions 1-74 are deprecated; requests use minor version 75 (Intuit Developer post https://medium.com/intuitdev/changes-to-our-accounting-api-that-may-impact-your-application-c330bd1a06f5). Send minorversion=75.
- Payment API https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/payment : POST /v3/company/<realmID>/payment, minimum TotalAmt + CustomerRef; apply to an invoice with Line:[{Amount, LinkedTxn:[{TxnId:<invoiceId>, TxnType:"Invoice"}]}]; PaymentRefNum optional (max 21 chars); without DepositToAccountRef the payment goes to Undeposited Funds.

## Accounting retry safeguards (verified 2026-11-03)
Intuit recommends the `requestid` query parameter for writes; a repeat with the same request ID and content returns the original response rather than creating another entity. IDs must be company-wide unique and no more than 50 characters. Sources read directly: https://help.developer.intuit.com/s/article/What-is-RequestId-and-its-usage and https://static.developer.intuit.com/output_html/qbo/docs/learn/learn-basic-field-definitions.html . The implementation serializes each CRM entity's create/link action with a MySQL row lock and derives a stable, company/entity/site-scoped 48-character request ID; conflicting links are never silently replaced. Remote token authorization and live create/replay behavior still require the owner's Intuit app and company authorization. No retention duration for remote request-ID history is claimed.
