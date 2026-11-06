import { getTableName } from "drizzle-orm";
import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dep = vi.hoisted(() => ({
  getDb: vi.fn(),
  create: vi.fn(),
  retrieve: vi.fn(),
  expire: vi.fn(),
}));
vi.mock("./db", () => ({ getDb: dep.getDb }));
vi.mock("stripe", () => ({
  default: class {
    checkout = {
      sessions: {
        create: dep.create,
        retrieve: dep.retrieve,
        expire: dep.expire,
      },
    };
  },
}));
import {
  cancelPaymentRequest,
  createCheckoutForToken,
  getPublicPaymentRequest,
  handleStripeEvent,
} from "./stripePayments";

type Row = Record<string, any>;
let request: Row;
let events: Row[];
let ledger: Row[];
let locks: string[];
let selectRequest: number;
const db = {
  select(projection?: Row) {
    let table = "";
    const chain: any = {
      from(t: any) {
        table = getTableName(t);
        return chain;
      },
      innerJoin() {
        return chain;
      },
      where() {
        return chain;
      },
      limit() {
        return chain;
      },
      for() {
        locks.push(table);
        return chain;
      },
      then(resolve: any, reject: any) {
        let rows: Row[] = [];
        if (table === "stripe_events") rows = [...events];
        else if (table === "payments") rows = [...ledger];
        else if (table === "customers") rows = [{ name: "Fixture Customer" }];
        else if (table === "payment_requests") {
          if (projection?.request)
            rows = [
              {
                request: { ...request },
                customerName: "Fixture Customer",
                customerEmail: "fixture@example.test",
                jobService: "painting",
              },
            ];
          else if (projection?.id)
            rows = request.paymentIntentId ? [{ id: request.id }] : [];
          else {
            selectRequest += 1;
            rows = [{ ...request }];
          }
        }
        return Promise.resolve(rows).then(resolve, reject);
      },
    };
    return chain;
  },
  insert(t: any) {
    return {
      async values(row: Row) {
        (getTableName(t) === "stripe_events" ? events : ledger).push({
          ...row,
        });
        return [{ affectedRows: 1 }];
      },
    };
  },
  update() {
    return {
      set(patch: Row) {
        return {
          async where() {
            Object.assign(request, patch);
            return [{ affectedRows: 1 }];
          },
        };
      },
    };
  },
  async transaction<T>(work: (tx: any) => Promise<T>) {
    const snapshot = structuredClone({ request, events, ledger });
    try {
      return await work(db);
    } catch (error) {
      ({ request, events, ledger } = snapshot);
      throw error;
    }
  },
};

beforeEach(() => {
  request = {
    id: "preq_fixture",
    token: "fixture-token",
    jobId: "job_fixture",
    customerId: "cus_fixture",
    amount: "100.00",
    currency: "CAD",
    status: "open",
    description: "Painting deposit",
    checkoutSessionId: null,
    paymentIntentId: null,
  };
  events = [];
  ledger = [];
  locks = [];
  selectRequest = 0;
  dep.getDb.mockResolvedValue(db);
  dep.create.mockReset().mockResolvedValue({
    id: "cs_fixture",
    url: "https://checkout.stripe.com/fixture",
    status: "open",
  });
  dep.retrieve.mockReset().mockResolvedValue({
    id: "cs_fixture",
    url: "https://checkout.stripe.com/fixture",
    status: "open",
  });
  dep.expire
    .mockReset()
    .mockResolvedValue({ id: "cs_fixture", status: "expired" });
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fixture");
});
function event(currency = "cad", amount = 10000): Stripe.Event {
  return {
    id: "evt_fixture",
    type: "payment_intent.succeeded",
    data: {
      object: {
        id: "pi_fixture",
        currency,
        amount_received: amount,
        metadata: { payment_request_id: request.id },
      },
    },
  } as unknown as Stripe.Event;
}

describe("Stripe checkout lifecycle with isolated dependencies", () => {
  it("reuses the active checkout instead of charging from independent sessions", async () => {
    await createCheckoutForToken("fixture-token", "https://example.test");
    await createCheckoutForToken("fixture-token", "https://example.test");
    expect(dep.create).toHaveBeenCalledTimes(1);
    expect(dep.retrieve).toHaveBeenCalledTimes(1);
    expect(locks).toContain("payment_requests");
    expect(dep.create.mock.calls[0][1].idempotencyKey).toContain(
      "preq_fixture"
    );
  });
  it("blocks a second checkout while a completed session awaits its webhook", async () => {
    request.checkoutSessionId = "cs_fixture";
    dep.retrieve.mockResolvedValue({ id: "cs_fixture", status: "complete" });
    expect(
      await createCheckoutForToken("fixture-token", "https://example.test")
    ).toEqual({ error: "processing" });
    expect(dep.create).not.toHaveBeenCalled();
  });
  it("expires an open Stripe session before marking its request cancelled", async () => {
    request.checkoutSessionId = "cs_fixture";
    expect(await cancelPaymentRequest(request.id)).toBe("cancelled");
    expect(dep.expire).toHaveBeenCalledWith("cs_fixture");
    expect(request.status).toBe("cancelled");
  });
  it("does not hide a completed checkout by cancelling its request", async () => {
    request.checkoutSessionId = "cs_fixture";
    dep.retrieve.mockResolvedValue({ id: "cs_fixture", status: "complete" });
    expect(await cancelPaymentRequest(request.id)).toBe("not_open");
    expect(request.status).toBe("open");
  });
  it("records one ledger receipt and ignores a repeated verified event", async () => {
    const first = await handleStripeEvent(event());
    const second = await handleStripeEvent(event());
    expect(first.fulfilled?.amount).toBe("100.00");
    expect(second.duplicate).toBe(true);
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({
      source: "stripe",
      currency: "CAD",
      amount: "100.00",
    });
    expect(request.status).toBe("paid");
  });
  it("rolls back fulfillment for a non-CAD currency", async () => {
    await expect(handleStripeEvent(event("usd"))).rejects.toThrow(
      "currency or amount"
    );
    expect(ledger).toHaveLength(0);
    expect(events).toHaveLength(0);
  });
  it("rejects an amount above the fixed request", async () => {
    await expect(handleStripeEvent(event("cad", 20000))).rejects.toThrow(
      "currency or amount"
    );
    expect(ledger).toHaveLength(0);
  });
  it("records the actual discounted receipt rather than the pre-discount amount", async () => {
    expect(
      (await handleStripeEvent(event("cad", 8000))).fulfilled?.amount
    ).toBe("80.00");
    expect(ledger[0].amount).toBe("80.00");
    expect((await getPublicPaymentRequest("fixture-token"))?.amount).toBe(
      "80.00"
    );
  });
});
