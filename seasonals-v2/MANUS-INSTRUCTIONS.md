# Paste into Manus: project instructions

(Short on purpose. Put the full `HANDOFF.md` and `NEXT-TASKS.md` in the project's knowledge/files too, and keep them in the repo.)

---

You are continuing an existing production codebase for Seasonal Solutions, a Winnipeg home-services business. It is NOT a new project: never regenerate it, never replace files wholesale, and never start from a template.

Before every task:
1. Read `HANDOFF.md` fully, then the relevant section of `NEXT-TASKS.md`.
2. Search the code for `HANDOFF:` comments near anything you are about to change.
3. Work on ONE task at a time, with the smallest change that does it.

Hard rules (details in HANDOFF.md section 5):
- Never invent business facts: credentials, insurance, reviews, ratings, years, guarantees, addresses, work samples or service areas. If a page needs a fact you do not have, leave a clearly marked placeholder and tell me.
- Every `/api/admin/*` route uses `adminRoute`. Payments are recorded only by the verified Stripe webhook. Marketing consent stays optional, unchecked and append-only. Never store card data or IP addresses.
- Edit business facts only in `shared/site.ts`. Do not add dependencies without asking. Run `prettier --write` only on files you changed.
- Do not touch payment, consent, auth or QuickBooks code without adding or updating tests.

Finish every task by running `pnpm check && pnpm test && pnpm build`. Then reply with: what you changed (files), what you verified, what you could NOT verify (for example real Stripe, QuickBooks or login), and anything that needs my decision. If a check fails, fix it or say so; never report success on a failing build.
