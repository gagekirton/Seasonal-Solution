# Changes in v2

Dashboard
- New admin shell: collapsible sidebar (remembered), breadcrumb top bar, alerts bell, Sign out.
- Overview split into tabs (Overview, Money, Traffic and leads, Reports) with Goals, Quick actions and CSV reports.
- New endpoints: GET /api/admin/alerts, POST /api/admin/logout.
- Fixed QuickBooks status mismatch (needs_reauth -> needs_reconnect) on Overview and Integrations.
- Fixed horizontal overflow of the admin on phones.

Security and reliability
- Public quote form can no longer overwrite an existing customer's name/email/phone/area (it only fills blanks) and no longer reverses a recorded email opt-out.
- Owner is notified once per Stripe event when a webhook event cannot be processed.
- Blog cache is bounded (was unbounded for arbitrary /blog/<slug> requests).
- Dependencies: removed unused @aws-sdk/*, framer-motion, nanoid, @hookform/resolvers; updated express, axios, mysql2, drizzle-orm, zod, tRPC; pnpm overrides for proxy-addr, lodash, lodash-es, dompurify.
  `pnpm audit --prod`: 95 advisories (2 critical, 26 high) -> 12 (0 critical, 0 high).

Not changed (see audit): session cookie SameSite/lifetime, checkout redirect allowlist, EXIF stripping, SITE_ORIGIN env var, noindex on thin pages, dark mode.

Handoff
- Added HANDOFF.md, NEXT-TASKS.md and MANUS-INSTRUCTIONS.md, plus `HANDOFF:` comments in 27 key files (comments only; no behaviour change).
