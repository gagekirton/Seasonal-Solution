import { describe, expect, it } from "vitest";
import { containsPaymentCredentials } from "./inputSafety";

describe("payment credentials are not accepted into CRM text", () => {
  it("does not scan validated internal identifiers as customer text", () => {
    expect(
      containsPaymentCredentials({
        customerId: "cus_41111111-1111-1111-1111-111111111111",
        note: "Normal job note",
      })
    ).toBe(false);
  });
  it.each([
    "4111111111111111",
    "4111 1111 1111 1111",
    "3782-822463-10005",
    "bank account: 123456789",
    "IBAN: GB12345678901234567890",
  ])("rejects likely credential %s", value => {
    expect(containsPaymentCredentials({ note: value })).toBe(true);
  });
  it.each([
    "Repair 12 steps at 45 Example Lane",
    "Receipt 2026-10001",
    "+1 (204) 555-0123",
    "4111111111111112",
  ])("allows ordinary noncredential text %s", value => {
    expect(containsPaymentCredentials(value)).toBe(false);
  });
});
