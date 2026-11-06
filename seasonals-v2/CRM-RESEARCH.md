# CRM consent implementation notes

**Date checked:** 2026-10-28

The CRTC’s CASL guidance states that commercial electronic messages require consent, sender identification and an unsubscribe mechanism. It explains that express consent must be a proactive opt-in, and that a business should keep evidence of consent and resulting unsubscribe actions. The guide also states unsubscribe requests must be respected within 10 business days. The CRTC FAQ describes express consent as withdrawable at any time and repeats the three general requirements. The FAQ labels its information as general guidance rather than legal advice.

Product decisions derived from this guidance: project-response consent stays required and distinct from an optional, initially unchecked email-marketing consent; consent evidence records timestamp, source and wording version; a later opt-out is retained; an inquiry or purchase alone does not set marketing permission; this CRM does not send email/SMS or automatic campaign reminders. Confirm current business practices and obtain legal advice if message sending is later added.

Sources:

- https://crtc.gc.ca/eng/com500/guide.htm — CRTC, “From Canada’s Anti-Spam Legislation (CASL) Guidance on Implied Consent”.
- https://crtc.gc.ca/eng/com500/faq500.htm — CRTC, “Frequently Asked Questions about Canada’s Anti-Spam Legislation”.
