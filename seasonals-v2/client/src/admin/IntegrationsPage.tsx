import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Plug,
  RefreshCw,
  Unplug,
} from "lucide-react";
import { AdminFrame, Notice, Panel } from "./AdminShell";
import { api, errorText, formatDateTime, sendJson } from "./api";

type QboStatus = {
  configured: boolean;
  callbackPath: string;
  connection: {
    environment: "sandbox" | "production";
    realmId: string;
    companyName: string | null;
    status: "connected" | "needs_reconnect" | "error";
    connectedAt: string;
    refreshTokenExpiresAt: string | null;
    defaultItemId: string | null;
    defaultItemName: string | null;
    defaultTaxCodeId: string | null;
    defaultTaxCodeName: string | null;
    autoSyncPayments: boolean;
  } | null;
  events: Array<{
    id: number;
    action: string;
    localId: string | null;
    outcome: "success" | "error";
    message: string;
    createdAt: string;
  }>;
};

type Options = {
  items: Array<{ id: string; name: string; type: string | null }>;
  taxCodes: Array<{ id: string; name: string }>;
};

export function IntegrationsPage() {
  const initialParams = new URLSearchParams(window.location.search);
  const initialType = initialParams.get("sync");
  const [status, setStatus] = useState<QboStatus | null>(null);
  const [options, setOptions] = useState<Options | null>(null);
  const [environment, setEnvironment] = useState<"sandbox" | "production">(
    "sandbox"
  );
  const [itemId, setItemId] = useState("");
  const [taxId, setTaxId] = useState("");
  const [autoSync, setAutoSync] = useState(false);
  const [syncType, setSyncType] = useState<"customer" | "invoice" | "payment">(
    initialType === "customer" || initialType === "payment"
      ? initialType
      : "invoice"
  );
  const [syncId, setSyncId] = useState(initialParams.get("id") ?? "");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState<{
    kind: "error" | "success" | "info";
    text: string;
  } | null>(null);

  const refresh = () => {
    api<QboStatus>("/api/admin/integrations/quickbooks")
      .then(result => {
        setStatus(result);
        if (result.connection) {
          setEnvironment(result.connection.environment);
          setItemId(result.connection.defaultItemId ?? "");
          setTaxId(result.connection.defaultTaxCodeId ?? "");
          setAutoSync(result.connection.autoSyncPayments);
          if (result.connection.status === "connected") {
            void api<Options>("/api/admin/integrations/quickbooks/options")
              .then(setOptions)
              .catch(() => setOptions(null));
          }
        }
      })
      .catch(error =>
        setMessage({
          kind: "error",
          text: errorText(error, "Integration status could not be loaded."),
        })
      );
  };
  useEffect(() => {
    refresh();
    const outcome = new URLSearchParams(window.location.search).get(
      "quickbooks"
    );
    if (outcome) {
      const text: Record<string, string> = {
        connected: "QuickBooks connected. Choose your invoice defaults below.",
        denied: "QuickBooks authorization was cancelled.",
        expired:
          "The QuickBooks authorization session expired. Start again when ready.",
        failed:
          "QuickBooks could not be connected. Check the app callback address and try again.",
      };
      setMessage({
        kind: outcome === "connected" ? "success" : "error",
        text: text[outcome] ?? "QuickBooks connection updated.",
      });
      window.history.replaceState(null, "", "/admin/integrations");
    }
  }, []);

  async function connect() {
    setBusy("connect");
    setMessage(null);
    try {
      const result = await sendJson<{ authorizeUrl: string }>(
        "/api/admin/integrations/quickbooks/connect",
        "POST",
        { environment, origin: window.location.origin }
      );
      window.location.assign(result.authorizeUrl);
    } catch (error) {
      setMessage({
        kind: "error",
        text: errorText(error, "QuickBooks connection could not be started."),
      });
      setBusy("");
    }
  }

  async function disconnect() {
    if (
      !window.confirm(
        "Disconnect QuickBooks? Stored accounting tokens will be deleted from this site."
      )
    )
      return;
    setBusy("disconnect");
    try {
      await sendJson(
        "/api/admin/integrations/quickbooks/disconnect",
        "POST",
        {}
      );
      setOptions(null);
      setMessage({
        kind: "success",
        text: "QuickBooks disconnected and local tokens deleted.",
      });
      refresh();
    } catch (error) {
      setMessage({
        kind: "error",
        text: errorText(error, "QuickBooks could not be disconnected."),
      });
    } finally {
      setBusy("");
    }
  }

  async function saveSettings() {
    setBusy("settings");
    setMessage(null);
    try {
      const item = options?.items.find(value => value.id === itemId) ?? null;
      const tax = options?.taxCodes.find(value => value.id === taxId) ?? null;
      await sendJson("/api/admin/integrations/quickbooks/settings", "PUT", {
        defaultItemId: item?.id ?? null,
        defaultItemName: item?.name ?? null,
        defaultTaxCodeId: tax?.id ?? null,
        defaultTaxCodeName: tax?.name ?? null,
        autoSyncPayments: autoSync,
      });
      setMessage({ kind: "success", text: "QuickBooks defaults saved." });
      refresh();
    } catch (error) {
      setMessage({
        kind: "error",
        text: errorText(error, "QuickBooks defaults could not be saved."),
      });
    } finally {
      setBusy("");
    }
  }

  async function syncRecord() {
    setBusy("sync");
    setMessage(null);
    try {
      await sendJson("/api/admin/integrations/quickbooks/sync", "POST", {
        type: syncType,
        id: syncId.trim(),
      });
      setMessage({
        kind: "success",
        text:
          syncType === "customer"
            ? "Customer synced to QuickBooks."
            : syncType === "invoice"
              ? "QuickBooks invoice created or existing link returned."
              : "Recorded payment pushed to QuickBooks.",
      });
      refresh();
    } catch (error) {
      setMessage({
        kind: "error",
        text: errorText(error, "QuickBooks sync could not be completed."),
      });
    } finally {
      setBusy("");
    }
  }

  const connection = status?.connection;
  return (
    <AdminFrame
      current="integrations"
      title="Integrations"
      description="Connect payments and accounting carefully. Customer data remains private and card details never enter this dashboard."
    >
      <Notice kind={message?.kind}>{message?.text}</Notice>
      <div className="dash-grid-2">
        <Panel title="Stripe online payments">
          <div className="integration-card">
            <CheckCircle2 size={26} className="integration-stripe" />
            <div>
              <b>Stripe Checkout</b>
              <p>
                Owners create links from the Payments page. Stripe hosts
                checkout and a verified webhook records completed payments
                against the service job.
              </p>
              <a href="/admin/payments">
                Open payment requests <ExternalLink size={14} />
              </a>
            </div>
          </div>
        </Panel>
        <Panel title="QuickBooks Online">
          {!status ? (
            <div className="admin-state">
              <span className="loader-dot" /> Checking QuickBooks…
            </div>
          ) : !status.configured ? (
            <div className="integration-card integration-muted">
              <Plug size={26} />
              <div>
                <b>QuickBooks app credentials required</b>
                <p>
                  This dashboard is ready for QuickBooks Online, but it needs an
                  Intuit Client ID and Client Secret before an owner can
                  authorize a company. Add them as protected project secrets;
                  they are never exposed in the browser.
                </p>
              </div>
            </div>
          ) : !connection ? (
            <div className="integration-connect">
              <p>
                Choose the Intuit environment, then authorize the company in
                QuickBooks. Use Sandbox only with an Intuit developer test
                company.
              </p>
              <label>
                Environment
                <select
                  value={environment}
                  onChange={event =>
                    setEnvironment(event.target.value as typeof environment)
                  }
                >
                  <option value="sandbox">Sandbox (testing)</option>
                  <option value="production">Production (live books)</option>
                </select>
              </label>
              <button
                className="button button-primary"
                type="button"
                disabled={busy === "connect"}
                onClick={() => void connect()}
              >
                <Plug size={16} />{" "}
                {busy === "connect" ? "Opening Intuit…" : "Connect QuickBooks"}
              </button>
              <small>
                The callback is handled by this site at{" "}
                <code>{`${window.location.origin}${status.callbackPath}`}</code>
                . Connection tokens are encrypted at rest.
              </small>
            </div>
          ) : (
            <div className="integration-card">
              <CheckCircle2
                size={26}
                className={
                  connection.status === "connected"
                    ? "integration-good"
                    : "integration-warn"
                }
              />
              <div>
                <b>{connection.companyName || "QuickBooks company"}</b>
                <p>
                  {connection.status === "connected"
                    ? `Connected to ${connection.environment} on ${formatDateTime(connection.connectedAt)}.`
                    : "Connection needs authorization again before records can sync."}
                </p>
                {connection.refreshTokenExpiresAt && (
                  <small>
                    Refresh token expiry:{" "}
                    {formatDateTime(connection.refreshTokenExpiresAt)}
                  </small>
                )}
                <button
                  className="button button-outline button-small"
                  type="button"
                  disabled={busy === "disconnect"}
                  onClick={() => void disconnect()}
                >
                  <Unplug size={14} /> Disconnect
                </button>
              </div>
            </div>
          )}
        </Panel>
      </div>

      {connection && (
        <>
          <Panel
            title="QuickBooks invoice defaults"
            action={
              <button
                className="button button-primary button-small"
                type="button"
                disabled={busy === "settings"}
                onClick={() => void saveSettings()}
              >
                {busy === "settings" ? "Saving…" : "Save defaults"}
              </button>
            }
          >
            {!options ? (
              <div className="admin-state">
                Loading available products and tax codes…
              </div>
            ) : (
              <div className="integration-settings">
                <label>
                  Invoice product / service item
                  <select
                    value={itemId}
                    onChange={event => setItemId(event.target.value)}
                  >
                    <option value="">Choose an item</option>
                    {options.items.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                        {item.type ? ` (${item.type})` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Default sales tax code
                  <select
                    value={taxId}
                    onChange={event => setTaxId(event.target.value)}
                  >
                    <option value="">No default tax code</option>
                    {options.taxCodes.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="dash-check">
                  <input
                    type="checkbox"
                    checked={autoSync}
                    onChange={event => setAutoSync(event.target.checked)}
                  />
                  <span>
                    Automatically push new Stripe and manually received payments
                    after a job's invoice link exists
                  </span>
                </label>
              </div>
            )}
          </Panel>
          <Panel title="Manual QuickBooks sync">
            <p className="dash-empty">
              Use the ID from a customer profile, service job or recorded
              payment to create or link the matching accounting record.
              Repeating a successful action returns the existing link. Later
              changes to customer details, job amounts, taxes and refunds must
              be reviewed in QuickBooks; this is not two-way synchronization.
            </p>
            <div className="manual-sync-form">
              <label>
                Record to sync
                <select
                  value={syncType}
                  onChange={event =>
                    setSyncType(
                      event.target.value as "customer" | "invoice" | "payment"
                    )
                  }
                >
                  <option value="customer">Customer profile (cus_…)</option>
                  <option value="invoice">Service job / invoice (job_…)</option>
                  <option value="payment">Recorded payment (pay_…)</option>
                </select>
              </label>
              <label>
                {syncType === "customer"
                  ? "Customer ID"
                  : syncType === "invoice"
                    ? "Service job ID"
                    : "Payment ID"}
                <input
                  value={syncId}
                  onChange={event => setSyncId(event.target.value)}
                  placeholder={
                    syncType === "customer"
                      ? "cus_…"
                      : syncType === "invoice"
                        ? "job_…"
                        : "pay_…"
                  }
                />
              </label>
              <button
                className="button button-primary"
                type="button"
                disabled={busy === "sync" || !syncId.trim()}
                onClick={() => void syncRecord()}
              >
                <RefreshCw size={15} />
                {busy === "sync" ? "Syncing…" : "Sync now"}
              </button>
            </div>
          </Panel>
          <Panel
            title="Recent QuickBooks activity"
            action={
              <button
                className="button button-outline button-small"
                type="button"
                onClick={refresh}
              >
                <RefreshCw size={14} /> Refresh
              </button>
            }
          >
            {status?.events.length === 0 ? (
              <p className="dash-empty">No QuickBooks activity yet.</p>
            ) : (
              <ul className="integration-events">
                {status?.events.map(event => (
                  <li key={event.id}>
                    <span
                      className={
                        event.outcome === "success"
                          ? "event-good"
                          : "event-error"
                      }
                    >
                      {event.outcome}
                    </span>
                    <div>
                      <b>{event.action}</b>
                      <p>{event.message}</p>
                      <small>
                        {formatDateTime(event.createdAt)}
                        {event.localId ? ` · ${event.localId}` : ""}
                      </small>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
    </AdminFrame>
  );
}
