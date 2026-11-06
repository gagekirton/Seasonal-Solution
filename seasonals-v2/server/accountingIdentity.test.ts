import { describe, expect, it } from "vitest";
import { accountingRequestId } from "./accountingIdentity";

describe("QuickBooks create retry identity", () => {
  it("reuses a bounded requestid for the same logical create", () => {
    const id = accountingRequestId("site-a", "company-1", "invoice", "job-1");
    expect(id).toBe(
      accountingRequestId("site-a", "company-1", "invoice", "job-1")
    );
    expect(id).toMatch(/^[a-f0-9]{48}$/);
  });
  it("never shares requestids across entities, companies, sites or rejected-name fallbacks", () => {
    const ids = [
      accountingRequestId("site-a", "company-1", "invoice", "same-id"),
      accountingRequestId("site-a", "company-1", "payment", "same-id"),
      accountingRequestId("site-a", "company-2", "invoice", "same-id"),
      accountingRequestId("site-b", "company-1", "invoice", "same-id"),
      accountingRequestId(
        "site-a",
        "company-1",
        "invoice",
        "same-id",
        "unique-name"
      ),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });
});
