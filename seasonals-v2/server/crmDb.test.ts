import { getTableName } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependency = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db", () => ({ getDb: dependency.getDb }));
import { createLeadWithCustomer, recordMarketingOptOut } from "./crmDb";

// This double exercises transaction orchestration without a network or DATABASE_URL.
type Row = Record<string, any>;
let rows: Record<string, Row[]>;
let failLead: boolean;
let locks: string[];
const tx = {
  insert(table: any) {
    const name = getTableName(table);
    return {
      values(value: Row) {
        return {
          async onDuplicateKeyUpdate() {
            if (
              !rows[name].some(
                row => row.normalizedEmail === value.normalizedEmail
              )
            )
              rows[name].push({ ...value });
          },
          then(
            resolve: (value: unknown) => unknown,
            reject: (reason: unknown) => unknown
          ) {
            if (name === "leads" && failLead)
              return Promise.reject(new Error("fixture failure")).then(
                resolve,
                reject
              );
            rows[name].push({ ...value });
            return Promise.resolve([{ affectedRows: 1 }]).then(resolve, reject);
          },
        };
      },
    };
  },
  select() {
    return {
      from(table: any) {
        const name = getTableName(table);
        return {
          where() {
            return {
              limit() {
                return {
                  for() {
                    locks.push(name);
                    return Promise.resolve(rows[name].map(row => ({ ...row })));
                  },
                };
              },
            };
          },
        };
      },
    };
  },
  update(table: any) {
    const name = getTableName(table);
    return {
      set(patch: Row) {
        return {
          async where() {
            for (const row of rows[name])
              for (const [key, value] of Object.entries(patch)) {
                // SQL LEAST is covered by source inspection; do not replace a Date with an SQL AST in this double.
                if (
                  key === "firstContactAt" &&
                  value &&
                  typeof value === "object" &&
                  !(value instanceof Date)
                )
                  continue;
                row[key] = value;
              }
            return [{ affectedRows: rows[name].length }];
          },
        };
      },
    };
  },
};
const fakeDb = {
  async transaction<T>(work: (transaction: typeof tx) => Promise<T>) {
    const original = structuredClone(rows);
    try {
      return await work(tx);
    } catch (error) {
      rows = original;
      throw error;
    }
  },
};
beforeEach(() => {
  rows = { customers: [], leads: [], consent_events: [], follow_ups: [] };
  failLead = false;
  locks = [];
  dependency.getDb.mockResolvedValue(fakeDb);
});
function inquiry(
  email = "customer@example.com",
  consentAt = new Date("2026-10-28T10:00:00Z"),
  name = "First Customer"
) {
  return {
    name,
    email,
    service: "handyman",
    projectType: "residential" as const,
    details: "Repair the front door handle",
    consentAt,
    status: "new" as const,
  };
}
describe("isolated transactional customer capture", () => {
  it("links repeated normalized email to one customer while preserving two inquiries", async () => {
    const first = await createLeadWithCustomer(
      inquiry("Customer@Example.com"),
      false
    );
    const second = await createLeadWithCustomer(
      inquiry(
        " customer@example.com ",
        new Date("2026-10-29T10:00:00Z"),
        "Latest Customer"
      ),
      false
    );
    expect(second).toBe(first);
    expect(rows.customers).toHaveLength(1);
    expect(rows.leads).toHaveLength(2);
    expect(rows.leads.every(row => row.customerId === first)).toBe(true);
    // A later public submission must not rewrite the known customer's name.
    expect(rows.customers[0].name).toBe("First Customer");
    expect(rows.leads[1].name).toBe("Latest Customer");
    expect(rows.customers[0].marketingConsentAt).toBeNull();
    expect(rows.consent_events).toHaveLength(0);
    expect(locks).toEqual(["customers", "customers"]);
  });

  it("does not regress latest contact or details when an earlier inquiry commits later", async () => {
    await createLeadWithCustomer(
      inquiry(
        "customer@example.com",
        new Date("2026-10-29T10:00:00Z"),
        "Latest Customer"
      ),
      false
    );
    await createLeadWithCustomer(
      inquiry(
        "customer@example.com",
        new Date("2026-10-28T10:00:00Z"),
        "Delayed Customer"
      ),
      false
    );
    expect(rows.customers[0].name).toBe("Latest Customer");
    expect(rows.customers[0].lastContactAt.toISOString()).toBe(
      "2026-10-29T10:00:00.000Z"
    );
    expect(rows.leads).toHaveLength(2);
  });

  it("keeps a recorded opt-out in force when the public form is submitted again", async () => {
    const id = await createLeadWithCustomer(inquiry(), true);
    await recordMarketingOptOut(id);
    await createLeadWithCustomer(inquiry(), false);
    expect(rows.customers[0].marketingOptOutAt).toBeInstanceOf(Date);
    await createLeadWithCustomer(inquiry(), true);
    expect(rows.consent_events.map(row => row.kind)).toEqual([
      "opt_in",
      "opt_out",
    ]);
    expect(rows.consent_events[0].consentText).toContain("optional");
    expect(rows.customers[0].marketingOptOutAt).toBeInstanceOf(Date);
    expect(rows.leads).toHaveLength(3);
  });

  it("fills blank phone or area on a known customer but never overwrites them", async () => {
    await createLeadWithCustomer({ ...inquiry(), phone: "2045550100" }, false);
    await createLeadWithCustomer(
      {
        ...inquiry("customer@example.com", new Date("2026-10-30T10:00:00Z")),
        phone: "2045559999",
        area: "St. Vital",
      },
      false
    );
    expect(rows.customers[0].phone).toBe("2045550100");
    expect(rows.customers[0].serviceArea).toBe("St. Vital");
  });

  it("rolls back the new profile and consent evidence if inquiry insertion fails", async () => {
    failLead = true;
    await expect(createLeadWithCustomer(inquiry(), true)).rejects.toThrow(
      "fixture failure"
    );
    expect(rows.customers).toHaveLength(0);
    expect(rows.leads).toHaveLength(0);
    expect(rows.consent_events).toHaveLength(0);
  });
});
