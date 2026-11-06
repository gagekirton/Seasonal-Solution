import React, { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowUpRight, Mail, Phone, Search } from "lucide-react";
import { SERVICES } from "../../../shared/site";
import { downloadPrivateCsv } from "../adminDownloads";
import { AdminFrame, Notice } from "./AdminShell";
import {
  LEAD_STATUS_LABELS,
  api,
  errorText,
  formatDateTime,
  sendJson,
  serviceLabel,
  timeAgo,
} from "./api";

type Lead = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  service: string;
  area: string | null;
  projectType: string;
  details: string;
  status: string;
  internalNote: string | null;
  createdAt: string;
  statusChangedAt: string | null;
  customerId: string | null;
  landingPath: string | null;
  sourcePath: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
};

const STATUSES = Object.keys(LEAD_STATUS_LABELS);

function LeadCard({
  lead,
  onChange,
}: {
  lead: Lead;
  onChange: (lead: Lead) => void;
}) {
  const [note, setNote] = useState(lead.internalNote ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    kind: "error" | "success";
    text: string;
  } | null>(null);
  const highlighted = useMemo(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("lead") ===
        String(lead.id),
    [lead.id]
  );

  async function save(patch: {
    status?: string;
    internalNote?: string | null;
  }) {
    setBusy(true);
    setMessage(null);
    try {
      await sendJson(`/api/admin/leads/${lead.id}`, "PATCH", patch);
      onChange({
        ...lead,
        ...(patch.status
          ? { status: patch.status, statusChangedAt: new Date().toISOString() }
          : {}),
        ...(patch.internalNote !== undefined
          ? { internalNote: patch.internalNote }
          : {}),
      });
      setMessage({
        kind: "success",
        text: patch.status
          ? `Marked ${LEAD_STATUS_LABELS[patch.status].toLowerCase()}.`
          : "Note saved.",
      });
    } catch (error) {
      setMessage({
        kind: "error",
        text: errorText(error, "The lead could not be updated."),
      });
    } finally {
      setBusy(false);
    }
  }

  const source = [lead.utmSource, lead.utmMedium, lead.utmCampaign]
    .filter(Boolean)
    .join(" / ");
  return (
    <article
      className={`lead-card ${highlighted ? "lead-card-highlight" : ""}`}
      id={`lead-${lead.id}`}
    >
      <div className="lead-card-head">
        <div>
          <span className={`lead-status status-${lead.status}`}>
            {LEAD_STATUS_LABELS[lead.status] ?? lead.status}
          </span>
          <h2>{lead.name}</h2>
          <span className="lead-sub">
            {serviceLabel(lead.service)} · {lead.projectType}
            {lead.area ? ` · ${lead.area}` : ""}
          </span>
        </div>
        <time dateTime={lead.createdAt} title={formatDateTime(lead.createdAt)}>
          {timeAgo(lead.createdAt)}
        </time>
      </div>
      <div className="lead-meta">
        <a
          href={`mailto:${lead.email}?subject=${encodeURIComponent(`Your ${serviceLabel(lead.service).toLowerCase()} request`)}`}
        >
          <Mail size={14} /> {lead.email}
        </a>
        {lead.phone && (
          <a href={`tel:${lead.phone}`}>
            <Phone size={14} /> {lead.phone}
          </a>
        )}
      </div>
      <p className="lead-details">{lead.details}</p>
      <p className="crm-lead-attribution">
        Source: {source || "direct / organic"}
        {lead.landingPath ? ` · landed on ${lead.landingPath}` : ""}
        {lead.sourcePath ? ` · sent from ${lead.sourcePath}` : ""}
      </p>
      <div className="lead-actions">
        {lead.status === "new" && (
          <button
            className="button button-primary button-small"
            type="button"
            disabled={busy}
            onClick={() => void save({ status: "contacted" })}
          >
            Mark contacted
          </button>
        )}
        <label className="status-control">
          Stage{" "}
          <select
            value={lead.status}
            disabled={busy}
            onChange={event => void save({ status: event.target.value })}
          >
            {STATUSES.map(status => (
              <option key={status} value={status}>
                {LEAD_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
        {lead.customerId && (
          <a
            className="crm-customer-link"
            href={`/admin/customers?customer=${encodeURIComponent(lead.customerId)}`}
          >
            Customer profile, jobs & payments <ArrowUpRight size={14} />
          </a>
        )}
      </div>
      <form
        className="lead-note"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          void save({ internalNote: note.trim() || null });
        }}
      >
        <label>
          Private note
          <textarea
            rows={2}
            maxLength={1000}
            value={note}
            onChange={event => setNote(event.target.value)}
            placeholder="Call notes, site visit date, quote sent… (never card details)"
          />
        </label>
        <button
          className="button button-outline button-small"
          type="submit"
          disabled={busy || note === (lead.internalNote ?? "")}
        >
          Save note
        </button>
      </form>
      {message && <Notice kind={message.kind}>{message.text}</Notice>}
    </article>
  );
}

export function LeadsPage() {
  const initial =
    typeof window === "undefined"
      ? new URLSearchParams()
      : new URLSearchParams(window.location.search);
  const [q, setQ] = useState(initial.get("q") ?? "");
  const [query, setQuery] = useState(initial.get("q") ?? "");
  const [status, setStatus] = useState(
    STATUSES.includes(initial.get("status") ?? "") ? initial.get("status")! : ""
  );
  const [service, setService] = useState(initial.get("service") ?? "");
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (status) params.set("status", status);
    if (service) params.set("service", service);
    window.history.replaceState(
      null,
      "",
      `/admin/leads${params.size ? `?${params}` : ""}`
    );
    setError("");
    api<{ leads: Lead[]; statusCounts: Record<string, number> }>(
      `/api/admin/leads?${params}`
    )
      .then(result => {
        if (!active) return;
        setLeads(result.leads);
        setCounts(result.statusCounts ?? {});
      })
      .catch(
        err => active && setError(errorText(err, "Leads could not be loaded."))
      );
    return () => {
      active = false;
    };
  }, [query, status, service]);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("lead");
    if (id && leads)
      document
        .getElementById(`lead-${id}`)
        ?.scrollIntoView({ block: "center" });
  }, [leads]);

  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  return (
    <AdminFrame
      current="leads"
      title="Leads"
      description="Every quote request, from first contact to won or lost."
      actions={
        <button
          className="button button-outline button-small"
          type="button"
          disabled={exporting}
          onClick={async () => {
            setExporting(true);
            try {
              await downloadPrivateCsv(
                "/api/admin/leads.csv",
                "seasonal-solutions-leads.csv"
              );
            } catch (err) {
              setError(errorText(err, "The export could not be downloaded."));
            } finally {
              setExporting(false);
            }
          }}
        >
          {exporting ? "Preparing…" : "Export CSV"}
        </button>
      }
    >
      <div className="chip-row" role="group" aria-label="Filter by stage">
        <button
          type="button"
          className={`chip ${status === "" ? "chip-active" : ""}`}
          aria-pressed={status === ""}
          onClick={() => setStatus("")}
        >
          All <span>{total}</span>
        </button>
        {STATUSES.map(item => (
          <button
            key={item}
            type="button"
            className={`chip ${status === item ? "chip-active" : ""}`}
            aria-pressed={status === item}
            onClick={() => setStatus(item)}
          >
            {LEAD_STATUS_LABELS[item]} <span>{counts[item] ?? 0}</span>
          </button>
        ))}
      </div>
      <form
        className="dash-filters"
        role="search"
        onSubmit={event => {
          event.preventDefault();
          setQuery(q.trim());
        }}
      >
        <label className="dash-search">
          <Search size={16} />
          <span className="sr-only">Search leads</span>
          <input
            value={q}
            maxLength={100}
            onChange={event => setQ(event.target.value)}
            placeholder="Search name, email, phone, area or details"
          />
        </label>
        <label>
          <span className="sr-only">Service</span>
          <select
            value={service}
            onChange={event => setService(event.target.value)}
          >
            <option value="">All services</option>
            {SERVICES.map(item => (
              <option key={item.slug} value={item.slug}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <button className="button button-primary button-small" type="submit">
          Search
        </button>
      </form>
      <Notice>{error}</Notice>
      {!leads ? (
        !error && (
          <div className="admin-state">
            <span className="loader-dot" /> Loading leads…
          </div>
        )
      ) : leads.length === 0 ? (
        <div className="empty-inbox">
          <h2>No matching leads</h2>
          <p>
            New quote requests from the website appear here instantly, and
            you'll get a notification for each one.
          </p>
        </div>
      ) : (
        <div className="lead-list">
          {leads.map(lead => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onChange={next =>
                setLeads(
                  current =>
                    current?.map(item => (item.id === next.id ? next : item)) ??
                    null
                )
              }
            />
          ))}
        </div>
      )}
    </AdminFrame>
  );
}
