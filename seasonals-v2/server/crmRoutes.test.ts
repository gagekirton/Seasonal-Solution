import express from "express";
import type { Server } from "node:http";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocked = vi.hoisted(() => ({
  authorize: vi.fn(),
  createCrmFollowUp: vi.fn(),
  createCrmJob: vi.fn(),
  getCrmCustomer: vi.fn(),
  getCrmOverview: vi.fn(),
  listCrmCustomers: vi.fn(),
  listCrmFollowUps: vi.fn(),
  recordJobPayment: vi.fn(),
  recordMarketingOptOut: vi.fn(),
  updateCrmCustomer: vi.fn(),
  updateCrmFollowUp: vi.fn(),
  updateCrmJob: vi.fn(),
  autoPushPayment: vi.fn(),
}));
vi.mock("./crmDb", () => mocked);
vi.mock("./quickbooks", () => ({ autoPushPayment: mocked.autoPushPayment }));
vi.mock("./_core/adminAccess", () => ({
  requireCrmAdministrator: mocked.authorize,
  adminDeniedStatus: () => 401,
}));
import { registerCrmRoutes } from "./crmRoutes";

const customerId = "cus_00000000-0000-0000-0000-000000000001";
const jobId = "job_00000000-0000-0000-0000-000000000001";
const taskId = "task_00000000-0000-0000-0000-000000000001";
let server: Server;
let origin: string;

// Every database and authentication dependency is mocked. No shared DB is used.
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  registerCrmRoutes(app);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.on("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  origin = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server.close(error => (error ? reject(error) : resolve()))
  );
});
beforeEach(() => {
  vi.resetAllMocks();
  mocked.authorize.mockResolvedValue({
    openId: "configured-owner",
    role: "admin",
  });
});
async function request(path: string, method = "GET", body?: unknown) {
  return fetch(`${origin}/api/admin/crm${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("isolated CRM endpoint boundaries", () => {
  it.each([
    ["GET", "/overview"],
    ["GET", "/customers"],
    ["GET", "/customers.csv"],
    ["GET", `/customers/${customerId}`],
    ["PATCH", `/customers/${customerId}`],
    ["POST", `/customers/${customerId}/marketing-opt-out`],
    ["POST", "/jobs"],
    ["PATCH", `/jobs/${jobId}`],
    ["POST", `/jobs/${jobId}/payments`],
    ["GET", "/follow-ups"],
    ["POST", "/follow-ups"],
    ["PATCH", `/follow-ups/${taskId}`],
  ])("denies %s %s before any database call", async (method, path) => {
    mocked.authorize.mockResolvedValue(null);
    const response = await request(
      path,
      method,
      method === "GET" ? undefined : {}
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    for (const [key, fn] of Object.entries(mocked)) {
      if (key !== "authorize") expect(fn).not.toHaveBeenCalled();
    }
  });

  it("does not clear quote or booked amounts on a status-only patch", async () => {
    mocked.updateCrmJob.mockResolvedValue(true);
    const response = await request(`/jobs/${jobId}`, "PATCH", {
      status: "booked",
    });
    expect(response.status).toBe(200);
    const patch = mocked.updateCrmJob.mock.calls[0][1];
    expect(patch.status).toBe("booked");
    expect(patch).not.toHaveProperty("quotedAmount");
    expect(patch).not.toHaveProperty("bookedAmount");
  });

  it.each([0, -1, 1.001, 10000000])(
    "rejects invalid payment amount %s",
    async amount => {
      const response = await request(`/jobs/${jobId}/payments`, "POST", {
        kind: "payment",
        amount,
      });
      expect(response.status).toBe(400);
      expect(mocked.recordJobPayment).not.toHaveBeenCalled();
    }
  );

  it("normalizes a valid manual CAD entry to two-decimal storage", async () => {
    mocked.recordJobPayment.mockResolvedValue({ id: "pay_test" });
    const response = await request(`/jobs/${jobId}/payments`, "POST", {
      kind: "payment",
      amount: 123.45,
    });
    expect(response.status).toBe(201);
    expect(mocked.recordJobPayment.mock.calls[0][0]).toMatchObject({
      jobId,
      amount: "123.45",
      kind: "payment",
    });
    await vi.waitFor(() =>
      expect(mocked.autoPushPayment).toHaveBeenCalledWith("pay_test")
    );
  });

  it("keeps an already-issued Stripe refund on the online channel and never pushes it as a received payment", async () => {
    mocked.recordJobPayment.mockResolvedValue({ id: "pay_refund" });
    const response = await request(`/jobs/${jobId}/payments`, "POST", {
      kind: "refund",
      amount: 20,
      source: "stripe",
    });
    expect(response.status).toBe(201);
    expect(mocked.recordJobPayment.mock.calls[0][0]).toMatchObject({
      kind: "refund",
      source: "stripe",
      amount: "20.00",
    });
    await new Promise(resolve => setImmediate(resolve));
    expect(mocked.autoPushPayment).not.toHaveBeenCalled();
  });

  it("rejects a booked amount on a merely quoted job", async () => {
    const response = await request("/jobs", "POST", {
      customerId,
      service: "handyman",
      summary: "Repair door",
      status: "quoted",
      bookedAmount: 500,
    });
    expect(response.status).toBe(400);
    expect(mocked.createCrmJob).not.toHaveBeenCalled();
  });

  it("rejects payment-card details in manual ledger notes", async () => {
    const response = await request(`/jobs/${jobId}/payments`, "POST", {
      kind: "payment",
      amount: 100,
      note: "card 4111 1111 1111 1111",
    });
    expect(response.status).toBe(400);
    expect(mocked.recordJobPayment).not.toHaveBeenCalled();
  });

  it("reports a refund above the net recorded balance as a conflict", async () => {
    mocked.recordJobPayment.mockResolvedValue({
      error: "refund_exceeds_balance",
    });
    const response = await request(`/jobs/${jobId}/payments`, "POST", {
      kind: "refund",
      amount: 100,
    });
    expect(response.status).toBe(409);
  });

  it("preserves the consent-required denial for seasonal tasks", async () => {
    mocked.createCrmFollowUp.mockResolvedValue({ consentRequired: true });
    const response = await request("/follow-ups", "POST", {
      customerId,
      type: "seasonal",
      title: "Seasonal check-in",
      dueAt: "2027-04-01T17:00:00.000Z",
    });
    expect(response.status).toBe(409);
  });

  it("serves the overdue-only task filter", async () => {
    mocked.listCrmFollowUps.mockResolvedValue([]);
    const response = await request("/follow-ups?status=overdue");
    expect(response.status).toBe(200);
    expect(mocked.listCrmFollowUps).toHaveBeenCalledWith("overdue");
  });

  it("does not reopen a seasonal task after permission is withdrawn", async () => {
    mocked.updateCrmFollowUp.mockResolvedValue({ consentRequired: true });
    const response = await request(`/follow-ups/${taskId}`, "PATCH", {
      status: "open",
    });
    expect(response.status).toBe(409);
  });

  it("exports quoted CSV cells safely and remains private", async () => {
    mocked.listCrmCustomers.mockResolvedValue([
      {
        id: customerId,
        name: '=HYPERLINK("bad")',
        email: "person@example.com",
        phone: "+12049993247",
        serviceArea: "Winnipeg",
        jobCount: 1,
        completedJobCount: 1,
        bookedValue: 123.45,
        collectedValue: 100,
      },
    ]);
    const response = await request("/customers.csv");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.text()).toContain('"\'=HYPERLINK(""bad"")"');
  });
});
