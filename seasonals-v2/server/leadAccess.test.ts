import { describe, expect, it } from "vitest";
import { canAccessLeadInbox } from "./leadAccess";

describe("lead inbox authorization", () => {
  it("does not treat the public contact email as an admin credential", () => {
    expect(
      canAccessLeadInbox(
        {
          openId: "unconfigured-account",
          role: "user",
          email: "coled204@hotmail.com",
        },
        ""
      )
    ).toBe(false);
  });

  it("allows the explicitly configured owner identity", () => {
    expect(
      canAccessLeadInbox(
        { openId: "business-owner-123", role: "user" },
        "business-owner-123"
      )
    ).toBe(true);
  });

  it("allows an account only when it has an explicit admin role", () => {
    expect(
      canAccessLeadInbox(
        { openId: "separate-admin-456", role: "admin" },
        "business-owner-123"
      )
    ).toBe(true);
  });

  it("fails closed for non-admin accounts without an owner identity", () => {
    expect(
      canAccessLeadInbox({ openId: "ordinary-user", role: "user" }, "")
    ).toBe(false);
  });
});
