import React, { useEffect, useState, type FormEvent } from "react";
import { Copy, CreditCard, ExternalLink, Plus, XCircle } from "lucide-react";
import { AdminFrame, Notice, Panel } from "./AdminShell";
import {
  api,
  copyText,
  errorText,
  formatDateTime,
  formatMoney,
  sendJson,
} from "./api";

type PaymentRequest = {
  id: string;
  token: string;
  jobId: string;
  customerId: string;
  amount: string;
  currency: string;
  description: string;
  status: "open" | "paid" | "cancelled";
  lastError: string | null;
  paymentIntentId: string | null;
  ledgerPaymentId: string | null;
  paidAt: string | null;
  createdAt: string;
  customerName: string;
  customerEmail: string;
  jobSummary: string;
  jobService: string;
};

function requestPath(request: PaymentRequest) {
  return `/pay/${request.token}`;
}

export function PaymentsPage() {
  const params =
    typeof window === "undefined"
      ? new URLSearchParams()
      : new URLSearchParams(window.location.search);
  const [requests, setRequests] = useState<PaymentRequest[] | null>(null);
  const [stripe, setStripe] = useState<{
    configured: boolean;
    mode: string;
  } | null>(null);
  const [jobId, setJobId] = useState(params.get("job") ?? "");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const [message, setMessage] = useState<{
    kind: "error" | "success";
    text: string;
  } | null>(null);

  const refresh = () => {
    api<{
      stripe: { configured: boolean; mode: string };
      requests: PaymentRequest[];
    }>("/api/admin/payments")
      .then(result => {
        setStripe(result.stripe);
        setRequests(result.requests);
      })
      .catch(error =>
        setMessage({
          kind: "error",
          text: errorText(error, "Payment requests could not be loaded."),
        })
      );
  };
  useEffect(refresh, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const result = await sendJson<{
        id: string;
        token: string;
        path: string;
      }>("/api/admin/payments", "POST", {
        jobId: jobId.trim(),
        amount: Number(amount),
        description: description.trim(),
      });
      setAmount("");
      setDescription("");
      setMessage({
        kind: "success",
        text: "Secure payment link created. Copy it before sending it to the customer.",
      });
      await copy(result.path);
      refresh();
    } catch (error) {
      setMessage({
        kind: "error",
        text: errorText(error, "The payment link could not be created."),
      });
    } finally {
      setBusy(false);
    }
  }

  async function copy(path: string) {
    const ok = await copyText(`${window.location.origin}${path}`);
    setCopyMessage(
      ok
        ? "Payment link copied."
        : "Copy the payment link from your browser address bar."
    );
    window.setTimeout(() => setCopyMessage(""), 2500);
  }

  async function cancel(request: PaymentRequest) {
    if (
      !window.confirm(
        `Cancel the open payment request for ${request.customerName}?`
      )
    )
      return;
    setBusy(true);
    setMessage(null);
    try {
      await sendJson(`/api/admin/payments/${request.id}/cancel`, "POST", {});
      setRequests(
        current =>
          current?.map(item =>
            item.id === request.id ? { ...item, status: "cancelled" } : item
          ) ?? null
      );
      setMessage({ kind: "success", text: "Payment request cancelled." });
    } catch (error) {
      setMessage({
        kind: "error",
        text: errorText(error, "The payment request could not be cancelled."),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminFrame
      current="payments"
      title="Online payments"
      description="Create a secure Stripe payment request for an existing service job. Card information is handled by Stripe, never here."
    >
      <Notice kind={message?.kind}>{message?.text}</Notice>
      {copyMessage && <Notice kind="success">{copyMessage}</Notice>}
      {stripe && !stripe.configured && (
        <Notice kind="info">
          Stripe has not been configured yet. You can prepare payment requests
          once the Stripe connection is ready.
        </Notice>
      )}
      <div className="dash-grid-2">
        <Panel title="Create a payment request">
          <form className="payment-request-form" onSubmit={create}>
            <label>
              Job ID <b>*</b>
              <input
                required
                pattern="job_[0-9a-fA-F-]{36}"
                value={jobId}
                onChange={event => setJobId(event.target.value)}
                placeholder="job_…"
              />
              <small>
                Open a customer profile to copy its service job ID, or use a job
                link from the CRM.
              </small>
            </label>
            <label>
              Amount (CAD) <b>*</b>
              <input
                required
                type="number"
                min="0.50"
                max="99999.99"
                step="0.01"
                value={amount}
                onChange={event => setAmount(event.target.value)}
                placeholder="0.00"
              />
            </label>
            <label>
              What is this for? <b>*</b>
              <input
                required
                minLength={3}
                maxLength={200}
                value={description}
                onChange={event => setDescription(event.target.value)}
                placeholder="e.g., Painting deposit — main floor"
              />
            </label>
            <button
              className="button button-primary"
              type="submit"
              disabled={busy || !stripe?.configured}
            >
              <Plus size={16} />{" "}
              {busy ? "Creating…" : "Create secure payment link"}
            </button>
          </form>
        </Panel>
        <Panel title="Stripe connection">
          <div className="payment-connection">
            <CreditCard size={24} />
            <div>
              <b>
                {stripe?.configured ? "Stripe is ready" : "Stripe needs setup"}
              </b>
              <p>
                {stripe?.configured
                  ? `${stripe.mode === "live" ? "Live" : "Test"} mode. Completed payments are added to the customer job ledger by a verified Stripe webhook.`
                  : "Connect Stripe before creating online payment links. This dashboard does not store card numbers."}
              </p>
              <a href="/admin/integrations">Manage integrations</a>
            </div>
          </div>
        </Panel>
      </div>
      <Panel title="Payment requests">
        {!requests ? (
          <div className="admin-state">
            <span className="loader-dot" /> Loading payment requests…
          </div>
        ) : requests.length === 0 ? (
          <p className="dash-empty">No online payment requests yet.</p>
        ) : (
          <div className="payment-request-list">
            {requests.map(request => (
              <article key={request.id} className="payment-request-row">
                <div>
                  <span
                    className={`lead-status ${request.status === "paid" ? "status-won" : request.status === "cancelled" ? "status-closed" : "status-contacted"}`}
                  >
                    {request.status}
                  </span>
                  <h2>{request.description}</h2>
                  <p>
                    <a
                      href={`/admin/customers?customer=${encodeURIComponent(request.customerId)}`}
                    >
                      {request.customerName}
                    </a>{" "}
                    · {request.jobService} · {request.jobSummary}
                  </p>
                  <small>
                    Created {formatDateTime(request.createdAt)}
                    {request.paidAt
                      ? ` · paid ${formatDateTime(request.paidAt)}`
                      : ""}
                    {request.lastError ? ` · ${request.lastError}` : ""}
                  </small>
                </div>
                <div className="payment-request-value">
                  <b>{formatMoney(request.amount)}</b>
                  <div>
                    <button
                      className="button button-outline button-small"
                      type="button"
                      onClick={() => void copy(requestPath(request))}
                    >
                      <Copy size={14} /> Copy link
                    </button>
                    <a
                      className="button button-outline button-small"
                      href={requestPath(request)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink size={14} /> View
                    </a>
                    {request.status === "open" && (
                      <button
                        className="icon-button-danger"
                        type="button"
                        aria-label="Cancel payment request"
                        disabled={busy}
                        onClick={() => void cancel(request)}
                      >
                        <XCircle size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </Panel>
    </AdminFrame>
  );
}
