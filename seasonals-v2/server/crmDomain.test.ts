import { describe, expect, it } from "vitest";
import {
  createCustomerId,
  createCrmId,
  isLatestContact,
  hasCurrentMarketingConsent,
  netCollectedValue,
  normalizeCustomerEmail,
} from "./crmDomain";

describe("CRM identity and value rules", () => {
  it("normalizes email deterministically for repeat customer matching", () => {
    expect(normalizeCustomerEmail("  Customer.Example@Email.COM ")).toBe(
      "customer.example@email.com"
    );
  });

  it("creates stable-format random customer IDs without embedding PII", () => {
    const first = createCustomerId();
    const second = createCustomerId();
    expect(first).toMatch(/^cus_[0-9a-f-]{36}$/i);
    expect(first).not.toBe(second);
    expect(first).not.toContain("@");
  });

  it("requires a recorded opt-in that has not been withdrawn", () => {
    expect(
      hasCurrentMarketingConsent({
        marketingConsentAt: new Date(),
        marketingOptOutAt: null,
      })
    ).toBe(true);
    expect(
      hasCurrentMarketingConsent({
        marketingConsentAt: new Date(),
        marketingOptOutAt: new Date(),
      })
    ).toBe(false);
    expect(
      hasCurrentMarketingConsent({
        marketingConsentAt: null,
        marketingOptOutAt: null,
      })
    ).toBe(false);
  });

  it("keeps later contact details when an earlier request is delayed", () => {
    expect(
      isLatestContact(
        new Date("2026-10-28T01:00:00Z"),
        new Date("2026-10-28T02:00:00Z")
      )
    ).toBe(false);
    expect(
      isLatestContact(
        new Date("2026-10-28T03:00:00Z"),
        new Date("2026-10-28T02:00:00Z")
      )
    ).toBe(true);
  });

  it("uses a task ID that fits its widened database column", () => {
    expect(createCrmId("task")).toHaveLength(41);
    expect(createCrmId("evt")).toHaveLength(40);
  });

  it("calculates collected value from recorded payments minus refunds only", () => {
    expect(
      netCollectedValue([
        { kind: "payment", amount: "125.00" },
        { kind: "payment", amount: "74.50" },
        { kind: "refund", amount: "25.00" },
      ])
    ).toBe(174.5);
    expect(netCollectedValue([{ kind: "payment", amount: "not-money" }])).toBe(
      0
    );
  });
});
