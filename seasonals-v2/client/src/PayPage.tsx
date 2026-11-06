import React, { useEffect, useState } from "react";
import { ArrowUpRight, CheckCircle2, Lock, Phone } from "lucide-react";
import { BUSINESS } from "../../shared/site";
import {
  formatPostDate,
  type PublicPaymentRequest,
} from "../../shared/content";
import { Brand } from "./Brand";
import { usePage } from "./Layout";

function money(amount: string, currency: string) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(
    Number(amount)
  );
}

export function PayPage() {
  const { data } = usePage();
  const [payment, setPayment] = useState<PublicPaymentRequest>(data.payment!);
  const [notice, setNotice] = useState<{
    kind: "info" | "error";
    text: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const outcome = new URLSearchParams(window.location.search).get("checkout");
    if (outcome === "cancelled")
      setNotice({
        kind: "info",
        text: "Checkout was cancelled. No payment was taken; you can try again.",
      });
    if (outcome !== "success" || payment.status !== "open") return;
    setChecking(true);
    let attempts = 0;
    let stopped = false;
    const poll = async () => {
      attempts += 1;
      try {
        const response = await fetch(`/api/pay/${payment.token}`, {
          cache: "no-store",
        });
        const body = (await response.json()) as {
          payment?: PublicPaymentRequest;
        };
        if (body.payment) {
          setPayment(body.payment);
          if (body.payment.status !== "open") {
            setChecking(false);
            return;
          }
        }
      } catch {
        // Keep polling briefly; the webhook may still be on its way.
      }
      if (attempts < 12 && !stopped) setTimeout(() => void poll(), 2500);
      else setChecking(false);
    };
    void poll();
    return () => {
      stopped = true;
    };
    // Poll once after returning from Checkout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startCheckout() {
    setBusy(true);
    setNotice(null);
    const tab = window.open("", "_blank");
    try {
      const response = await fetch(`/api/pay/${payment.token}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin: window.location.origin }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!response.ok || !body.url)
        throw new Error(body.error || "Secure checkout could not be started.");
      if (tab) {
        tab.location.href = body.url;
        setNotice({
          kind: "info",
          text: "Secure Stripe checkout opened in a new tab. Return here after paying to see confirmation.",
        });
      } else {
        window.location.assign(body.url);
      }
    } catch (error) {
      tab?.close();
      setNotice({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "Secure checkout could not be started.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main" className="pay-page">
      <div className="pay-card">
        <div className="pay-brand">
          <Brand />
          <span>
            <Lock size={14} /> Secure payment
          </span>
        </div>
        {payment.status === "paid" ? (
          <div className="pay-status pay-paid" role="status">
            <CheckCircle2 size={34} />
            <h1>
              Payment received — thank you
              {payment.customerFirstName
                ? `, ${payment.customerFirstName}`
                : ""}
              .
            </h1>
            <p>
              {money(payment.amount, payment.currency)} for{" "}
              {payment.description}
              {payment.paidAt
                ? ` was paid on ${formatPostDate(payment.paidAt)}.`
                : "."}{" "}
              Stripe emails a receipt when one is available.
            </p>
          </div>
        ) : payment.status === "cancelled" ? (
          <div className="pay-status">
            <h1>This payment request is no longer active.</h1>
            <p>
              Please contact Seasonal Solutions if you believe this is a
              mistake.
            </p>
          </div>
        ) : (
          <>
            <span className="pay-label">
              PAYMENT REQUEST
              {payment.customerFirstName
                ? ` FOR ${payment.customerFirstName.toUpperCase()}`
                : ""}
            </span>
            <h1>{payment.description}</h1>
            <p className="pay-service">{payment.serviceLabel}</p>
            <div className="pay-amount">
              <small>Amount due ({payment.currency})</small>
              <b>{money(payment.amount, payment.currency)}</b>
            </div>
            {checking ? (
              <div className="pay-notice" role="status">
                <span className="loader-dot" /> Confirming your payment with
                Stripe…
              </div>
            ) : (
              <button
                className="button button-primary pay-button"
                type="button"
                disabled={busy || !payment.stripeReady}
                onClick={() => void startCheckout()}
              >
                {busy
                  ? "Opening secure checkout…"
                  : `Pay ${money(payment.amount, payment.currency)} securely`}{" "}
                <ArrowUpRight size={17} />
              </button>
            )}
            {!payment.stripeReady && (
              <p className="pay-fine">
                Online payment is temporarily unavailable. Please contact us to
                pay another way.
              </p>
            )}
            <p className="pay-fine">
              Payments are processed by Stripe. Seasonal Solutions never sees or
              stores your card number.
            </p>
          </>
        )}
        {notice && (
          <div
            className={`form-message ${notice.kind === "error" ? "form-error" : "form-success"}`}
            role={notice.kind === "error" ? "alert" : "status"}
          >
            {notice.text}
          </div>
        )}
        <div className="pay-contact">
          Questions about this request?{" "}
          <a href={`tel:${BUSINESS.phone}`}>
            <Phone size={14} /> {BUSINESS.phoneDisplay}
          </a>{" "}
          · <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>
        </div>
      </div>
    </main>
  );
}
