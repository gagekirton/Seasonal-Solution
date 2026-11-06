/**
 * HANDOFF: Overview tabs (selected via the URL hash). Data comes from GET /api/admin/dashboard?range=.
 * Goals are stored in localStorage 'ss-admin-goals' (per browser): move to the database in NEXT-TASKS T6.
 */
import React, { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, Download, Minus } from "lucide-react";
import { downloadPrivateCsv } from "../adminDownloads";
import { AdminFrame, Notice, Panel } from "./AdminShell";
import {
  LEAD_STATUS_LABELS,
  api,
  errorText,
  formatDate,
  formatDay,
  formatMoney,
  serviceLabel,
  sourceLabel,
  timeAgo,
} from "./api";
import {
  excludeThisDeviceFromStats,
  isDeviceExcludedFromStats,
} from "../tracking";

type Kpis = {
  pageViews: number;
  visits: number;
  leads: number;
  conversionRate: number | null;
  newCustomers: number;
  jobsBooked: number;
  bookedValue: number;
  collectedValue: number;
  onlineCollected: number;
  manualCollected: number;
};

type Dashboard = {
  range: number;
  period: { start: string; end: string };
  kpis: Kpis;
  previous: Kpis;
  daily: Array<{ day: string; views: number; visits: number; leads: number }>;
  pipeline: Record<string, number>;
  leadsByService: Array<{ service: string; total: number }>;
  leadsBySource: Array<{ source: string; total: number }>;
  topPages: Array<{ path: string; views: number }>;
  trafficSources: Array<{ source: string; medium: string; visits: number }>;
  revenueByMonth: Array<{ month: string; online: number; manual: number }>;
  followUps: { open: number; overdue: number };
  needsResponse: {
    total: number;
    leads: Array<{
      id: number;
      name: string;
      service: string;
      area: string | null;
      createdAt: string;
    }>;
  };
  recentPayments: Array<{
    id: string;
    kind: "payment" | "refund";
    amount: number;
    source: string;
    recordedAt: string;
    customerName: string;
    customerId: string;
  }>;
  integrations: {
    stripe: { configured: boolean; mode: string };
    quickbooks: {
      configured: boolean;
      status: string;
      companyName: string | null;
    };
  };
};

const RANGES = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
  { value: 365, label: "12 months" },
];

const SPRUCE = "#1f5246";
const AMBER = "#c9772b";

function Delta({
  current,
  previous,
  invert = false,
}: {
  current: number;
  previous: number;
  invert?: boolean;
}) {
  if (previous === 0 && current === 0)
    return (
      <span className="kpi-delta kpi-flat">
        <Minus size={13} /> no change
      </span>
    );
  if (previous === 0)
    return (
      <span className="kpi-delta kpi-up">
        <ArrowUpRight size={13} /> new
      </span>
    );
  const change = Math.round(((current - previous) / previous) * 100);
  const up = change > 0;
  const good = invert ? !up : up;
  if (change === 0)
    return (
      <span className="kpi-delta kpi-flat">
        <Minus size={13} /> no change
      </span>
    );
  return (
    <span className={`kpi-delta ${good ? "kpi-up" : "kpi-down"}`}>
      {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
      {Math.abs(change)}% vs previous
    </span>
  );
}

function Kpi({
  label,
  value,
  current,
  previous,
  hint,
}: {
  label: string;
  value: string;
  current: number;
  previous: number;
  hint?: string;
}) {
  return (
    <div className="kpi">
      <span className="kpi-label">{label}</span>
      <b className="kpi-value">{value}</b>
      <Delta current={current} previous={previous} />
      {hint && <small className="kpi-hint">{hint}</small>}
    </div>
  );
}

function BarList({
  rows,
  empty,
}: {
  rows: Array<{ label: string; value: number; display?: string }>;
  empty: string;
}) {
  if (rows.length === 0) return <p className="dash-empty">{empty}</p>;
  const max = Math.max(...rows.map(row => row.value), 1);
  return (
    <ul className="bar-list">
      {rows.map(row => (
        <li key={row.label}>
          <span className="bar-list-label">{row.label}</span>
          <span className="bar-list-track" aria-hidden="true">
            <span style={{ width: `${(row.value / max) * 100}%` }} />
          </span>
          <b>{row.display ?? row.value.toLocaleString("en-CA")}</b>
        </li>
      ))}
    </ul>
  );
}

function monthLabel(month: string) {
  const [year, value] = month.split("-").map(Number);
  return new Date(year, value - 1, 1).toLocaleDateString("en-CA", {
    month: "short",
    year: "2-digit",
  });
}

type Tab = "overview" | "money" | "traffic" | "reports";
const TABS: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "money", label: "Money" },
  { id: "traffic", label: "Traffic and leads" },
  { id: "reports", label: "Reports" },
];

function initialTab(): Tab {
  const hash = window.location.hash.slice(1);
  return TABS.some(tab => tab.id === hash) ? (hash as Tab) : "overview";
}

type Goals = { revenue: number; leads: number };

function loadGoals(): Goals {
  try {
    const raw = JSON.parse(localStorage.getItem("ss-admin-goals") ?? "{}");
    return {
      revenue: Math.max(0, Number(raw.revenue) || 0),
      leads: Math.max(0, Number(raw.leads) || 0),
    };
  } catch {
    return { revenue: 0, leads: 0 };
  }
}

function GoalRow({
  label,
  actual,
  target,
  display,
}: {
  label: string;
  actual: number;
  target: number;
  display: (value: number) => string;
}) {
  const percent = target > 0 ? Math.round((actual / target) * 100) : 0;
  const state = percent >= 100 ? "Met" : percent >= 75 ? "Close" : "Behind";
  return (
    <div className="goal">
      <div className="goal-head">
        <b>{label}</b>
        <span
          className={`pill ${percent >= 100 ? "pill-ok" : percent >= 75 ? "" : "pill-warn"}`}
        >
          {state}
        </span>
      </div>
      <div
        className="goal-bar"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(percent, 100)}
      >
        <span style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
      <small>
        {display(actual)} of {display(target)} ({percent}%)
      </small>
    </div>
  );
}

function GoalsPanel({ data }: { data: Dashboard }) {
  const [goals, setGoals] = useState<Goals>(loadGoals);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ revenue: "", leads: "" });
  const scale = data.range / 30;
  const hasGoals = goals.revenue > 0 || goals.leads > 0;
  const showForm = editing || !hasGoals;

  const save = () => {
    const next = {
      revenue: Math.max(0, Number(draft.revenue) || 0),
      leads: Math.max(0, Math.round(Number(draft.leads) || 0)),
    };
    setGoals(next);
    setEditing(false);
    try {
      localStorage.setItem("ss-admin-goals", JSON.stringify(next));
    } catch {
      // The goals still apply until the page is closed.
    }
  };

  return (
    <Panel
      title="Goals"
      action={
        hasGoals ? (
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setDraft({
                revenue: goals.revenue ? String(goals.revenue) : "",
                leads: goals.leads ? String(goals.leads) : "",
              });
              setEditing(value => !value);
            }}
          >
            {editing ? "Cancel" : "Edit goals"}
          </button>
        ) : undefined
      }
    >
      {showForm ? (
        <div className="goal-form">
          <label>
            Money collected per 30 days (CAD)
            <input
              type="number"
              min="0"
              inputMode="decimal"
              value={draft.revenue}
              onChange={event =>
                setDraft({ ...draft, revenue: event.target.value })
              }
            />
          </label>
          <label>
            Quote requests per 30 days
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={draft.leads}
              onChange={event =>
                setDraft({ ...draft, leads: event.target.value })
              }
            />
          </label>
          <button
            type="button"
            className="button button-primary button-small"
            onClick={save}
          >
            Save goals
          </button>
          <small>Goals are per 30 days and saved in this browser only.</small>
        </div>
      ) : (
        <div className="goal-list">
          {goals.revenue > 0 && (
            <GoalRow
              label="Money collected"
              actual={data.kpis.collectedValue}
              target={goals.revenue * scale}
              display={value => formatMoney(value, true)}
            />
          )}
          {goals.leads > 0 && (
            <GoalRow
              label="Quote requests"
              actual={data.kpis.leads}
              target={Math.round(goals.leads * scale)}
              display={value => value.toLocaleString("en-CA")}
            />
          )}
          <small>
            Goals are per 30 days and scaled to the {data.range}-day range
            selected above.
          </small>
        </div>
      )}
    </Panel>
  );
}

function QuickActions() {
  const links = [
    ["/admin/payments", "Request a payment"],
    ["/admin/leads?status=new", "Reply to new quote requests"],
    ["/admin/follow-ups", "Plan a follow-up"],
    ["/admin/content", "Write a blog post"],
  ];
  return (
    <Panel title="Quick actions">
      <ul className="quick-list">
        {links.map(([href, label]) => (
          <li key={href}>
            <a href={href}>
              {label} <ArrowUpRight size={13} />
            </a>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function saveCsv(
  filename: string,
  header: string[],
  rows: Array<Array<string | number>>
) {
  const cell = (value: string | number) => {
    const text = String(value);
    const safe = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const body = [header, ...rows]
    .map(row => row.map(cell).join(","))
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob([`\uFEFF${body}`], { type: "text/csv;charset=utf-8" })
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function ReportsTab({ data }: { data: Dashboard }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const period = `${data.period.start}_to_${data.period.end}`;
  const download = async (path: string, filename: string) => {
    setBusy(path);
    setError("");
    try {
      await downloadPrivateCsv(path, filename);
    } catch (err) {
      setError(errorText(err, "The export could not be downloaded."));
    } finally {
      setBusy("");
    }
  };
  const privateReports = [
    [
      "/api/admin/leads.csv",
      "seasonal-solutions-leads.csv",
      "All quote requests",
      "Every lead with contact details, service and where it came from.",
    ],
    [
      "/api/admin/crm/customers.csv",
      "seasonal-solutions-customers.csv",
      "All customers",
      "Customer list with jobs, money booked and collected.",
    ],
  ];
  return (
    <>
      <Notice>{error}</Notice>
      <div className="dash-grid-2">
        <Panel title="Everything on file">
          <ul className="report-list">
            {privateReports.map(([path, file, title, text]) => (
              <li key={path}>
                <div>
                  <b>{title}</b>
                  <span>{text}</span>
                </div>
                <button
                  type="button"
                  className="button button-outline button-small"
                  disabled={busy === path}
                  onClick={() => void download(path, file)}
                >
                  <Download size={14} /> {busy === path ? "Preparing…" : "CSV"}
                </button>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel
          title={`This period (${formatDay(data.period.start)} – ${formatDay(data.period.end)})`}
        >
          <ul className="report-list">
            <li>
              <div>
                <b>Daily traffic and quote requests</b>
                <span>Visits, page views and quote requests for each day.</span>
              </div>
              <button
                type="button"
                className="button button-outline button-small"
                onClick={() =>
                  saveCsv(
                    `traffic-${period}.csv`,
                    ["Day", "Visits", "Page views", "Quote requests"],
                    data.daily.map(row => [
                      row.day,
                      row.visits,
                      row.views,
                      row.leads,
                    ])
                  )
                }
              >
                <Download size={14} /> CSV
              </button>
            </li>
            <li>
              <div>
                <b>Money collected by month</b>
                <span>
                  Online and manually recorded payments, net of refunds.
                </span>
              </div>
              <button
                type="button"
                className="button button-outline button-small"
                onClick={() =>
                  saveCsv(
                    "money-collected-by-month.csv",
                    ["Month", "Online (CAD)", "Recorded (CAD)"],
                    data.revenueByMonth.map(row => [
                      row.month,
                      row.online,
                      row.manual,
                    ])
                  )
                }
              >
                <Download size={14} /> CSV
              </button>
            </li>
          </ul>
        </Panel>
      </div>
    </>
  );
}

export function OverviewPage() {
  const [range, setRange] = useState(30);
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [excluded, setExcluded] = useState(false);
  const [tab, setTab] = useState<Tab>(initialTab);

  const chooseTab = (next: Tab) => {
    setTab(next);
    window.history.replaceState(
      null,
      "",
      next === "overview" ? window.location.pathname : `#${next}`
    );
  };

  useEffect(() => setExcluded(isDeviceExcludedFromStats()), []);
  useEffect(() => {
    let active = true;
    setError("");
    api<Dashboard>(`/api/admin/dashboard?range=${range}`)
      .then(result => active && setData(result))
      .catch(
        err =>
          active &&
          setError(errorText(err, "The dashboard could not be loaded."))
      );
    return () => {
      active = false;
    };
  }, [range]);

  const toggleExclusion = () => {
    excludeThisDeviceFromStats(!excluded);
    setExcluded(!excluded);
  };

  return (
    <AdminFrame
      current="overview"
      title="Business overview"
      description="Website traffic, leads, pipeline and revenue in one place."
      actions={
        <div className="segmented" role="group" aria-label="Date range">
          {RANGES.map(item => (
            <button
              key={item.value}
              type="button"
              className={range === item.value ? "segmented-active" : ""}
              aria-pressed={range === item.value}
              onClick={() => setRange(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      }
    >
      <Notice>{error}</Notice>
      {!data ? (
        !error && (
          <div className="admin-state">
            <span className="loader-dot" /> Loading your numbers…
          </div>
        )
      ) : (
        <>
          <div
            className="dash-tabs"
            role="tablist"
            aria-label="Dashboard views"
          >
            {TABS.map(item => (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`tab-${item.id}`}
                aria-selected={tab === item.id}
                aria-controls="dash-tabpanel"
                className={tab === item.id ? "dash-tab-active" : ""}
                onClick={() => chooseTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div
            id="dash-tabpanel"
            role="tabpanel"
            aria-labelledby={`tab-${tab}`}
          >
            {tab === "overview" && (
              <>
                <div className="kpi-grid">
                  <Kpi
                    label="Website visits"
                    value={data.kpis.visits.toLocaleString("en-CA")}
                    current={data.kpis.visits}
                    previous={data.previous.visits}
                    hint={`${data.kpis.pageViews.toLocaleString("en-CA")} page views`}
                  />
                  <Kpi
                    label="Quote requests"
                    value={data.kpis.leads.toLocaleString("en-CA")}
                    current={data.kpis.leads}
                    previous={data.previous.leads}
                    hint={
                      data.kpis.conversionRate === null
                        ? "No visits recorded yet"
                        : `${data.kpis.conversionRate}% of visits`
                    }
                  />
                  <Kpi
                    label="Jobs booked"
                    value={data.kpis.jobsBooked.toLocaleString("en-CA")}
                    current={data.kpis.jobsBooked}
                    previous={data.previous.jobsBooked}
                    hint={`${formatMoney(data.kpis.bookedValue, true)} booked value`}
                  />
                  <Kpi
                    label="Collected (net)"
                    value={formatMoney(data.kpis.collectedValue, true)}
                    current={data.kpis.collectedValue}
                    previous={data.previous.collectedValue}
                    hint={`${formatMoney(data.kpis.onlineCollected, true)} online · ${formatMoney(data.kpis.manualCollected, true)} recorded`}
                  />
                  <Kpi
                    label="New customers"
                    value={data.kpis.newCustomers.toLocaleString("en-CA")}
                    current={data.kpis.newCustomers}
                    previous={data.previous.newCustomers}
                  />
                </div>

                <div className="dash-grid-2">
                  <GoalsPanel data={data} />
                  <QuickActions />
                </div>

                <div className="dash-grid-2">
                  <Panel
                    title="Needs a response"
                    action={
                      <a href="/admin/leads?status=new">
                        All new leads <ArrowUpRight size={13} />
                      </a>
                    }
                  >
                    {data.needsResponse.leads.length === 0 ? (
                      <p className="dash-empty">
                        You're all caught up — no new quote requests are
                        waiting.
                      </p>
                    ) : (
                      <ul className="queue-list">
                        {data.needsResponse.leads.map(lead => (
                          <li key={lead.id}>
                            <a href={`/admin/leads?lead=${lead.id}`}>
                              <b>{lead.name}</b>
                              <span>
                                {serviceLabel(lead.service)}
                                {lead.area ? ` · ${lead.area}` : ""}
                              </span>
                            </a>
                            <time dateTime={lead.createdAt}>
                              {timeAgo(lead.createdAt)}
                            </time>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="dash-foot-note">
                      {data.needsResponse.total} new in total ·{" "}
                      {data.followUps.open} open follow-ups
                      {data.followUps.overdue > 0 && (
                        <>
                          {" "}
                          ·{" "}
                          <a href="/admin/follow-ups">
                            {data.followUps.overdue} overdue
                          </a>
                        </>
                      )}
                    </p>
                  </Panel>
                  <Panel
                    title="Lead pipeline"
                    action={
                      <a href="/admin/leads">
                        Manage leads <ArrowUpRight size={13} />
                      </a>
                    }
                  >
                    <BarList
                      empty="No leads in this period."
                      rows={Object.entries(data.pipeline).map(
                        ([status, total]) => ({
                          label: LEAD_STATUS_LABELS[status] ?? status,
                          value: total,
                        })
                      )}
                    />
                  </Panel>
                </div>

                <Panel title="Visits and quote requests">
                  <div className="chart-box">
                    <ResponsiveContainer width="100%" height={260}>
                      <AreaChart
                        data={data.daily}
                        margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient
                            id="visitsFill"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor={SPRUCE}
                              stopOpacity={0.25}
                            />
                            <stop
                              offset="100%"
                              stopColor={SPRUCE}
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#e7e1d4" vertical={false} />
                        <XAxis
                          dataKey="day"
                          tickFormatter={formatDay}
                          tick={{ fontSize: 12 }}
                          minTickGap={24}
                        />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                        <Tooltip
                          labelFormatter={value => formatDay(String(value))}
                        />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="visits"
                          name="Visits"
                          stroke={SPRUCE}
                          fill="url(#visitsFill)"
                          strokeWidth={2}
                        />
                        <Area
                          type="monotone"
                          dataKey="leads"
                          name="Quote requests"
                          stroke={AMBER}
                          fill="none"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>
              </>
            )}
            {tab === "money" && (
              <>
                <div className="dash-grid-2">
                  <Panel title="Revenue collected by month">
                    {data.revenueByMonth.length === 0 ? (
                      <p className="dash-empty">No payments recorded yet.</p>
                    ) : (
                      <div className="chart-box">
                        <ResponsiveContainer width="100%" height={240}>
                          <BarChart
                            data={data.revenueByMonth}
                            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                          >
                            <CartesianGrid stroke="#e7e1d4" vertical={false} />
                            <XAxis
                              dataKey="month"
                              tickFormatter={monthLabel}
                              tick={{ fontSize: 12 }}
                            />
                            <YAxis
                              tickFormatter={value =>
                                formatMoney(Number(value), true)
                              }
                              tick={{ fontSize: 11 }}
                              width={70}
                            />
                            <Tooltip
                              formatter={value => formatMoney(Number(value))}
                              labelFormatter={value =>
                                monthLabel(String(value))
                              }
                            />
                            <Legend />
                            <Bar
                              dataKey="online"
                              name="Online (Stripe)"
                              stackId="r"
                              fill={SPRUCE}
                            />
                            <Bar
                              dataKey="manual"
                              name="Recorded manually"
                              stackId="r"
                              fill={AMBER}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </Panel>
                  <Panel
                    title="Recent payments"
                    action={
                      <a href="/admin/payments">
                        Payments <ArrowUpRight size={13} />
                      </a>
                    }
                  >
                    {data.recentPayments.length === 0 ? (
                      <p className="dash-empty">
                        Payments appear here when recorded or paid online.
                      </p>
                    ) : (
                      <ul className="queue-list">
                        {data.recentPayments.map(payment => (
                          <li key={payment.id}>
                            <a
                              href={`/admin/customers?customer=${encodeURIComponent(payment.customerId)}`}
                            >
                              <b>{payment.customerName}</b>
                              <span>
                                {payment.source === "stripe"
                                  ? "Online"
                                  : "Recorded"}{" "}
                                · {formatDate(payment.recordedAt)}
                              </span>
                            </a>
                            <b
                              className={
                                payment.kind === "refund" ? "crm-refund" : ""
                              }
                            >
                              {payment.kind === "refund" ? "−" : ""}
                              {formatMoney(payment.amount)}
                            </b>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Panel>
                </div>
              </>
            )}
            {tab === "traffic" && (
              <>
                <div className="dash-grid-3">
                  <Panel title="Leads by service">
                    <BarList
                      empty="No leads in this period."
                      rows={data.leadsByService.map(row => ({
                        label: serviceLabel(row.service),
                        value: row.total,
                      }))}
                    />
                  </Panel>
                  <Panel title="Where leads came from">
                    <BarList
                      empty="No leads in this period."
                      rows={data.leadsBySource.map(row => ({
                        label: row.source,
                        value: row.total,
                      }))}
                    />
                  </Panel>
                  <Panel title="Traffic sources">
                    <BarList
                      empty="No visits recorded yet."
                      rows={data.trafficSources.map(row => ({
                        label: sourceLabel(row.source, row.medium),
                        value: row.visits,
                      }))}
                    />
                  </Panel>
                </div>

                <div className="dash-grid-2">
                  <Panel title="Most viewed pages">
                    <BarList
                      empty="No page views recorded yet."
                      rows={data.topPages.map(row => ({
                        label: row.path,
                        value: row.views,
                      }))}
                    />
                  </Panel>
                  <Panel
                    title="Connected services"
                    action={
                      <a href="/admin/integrations">
                        Integrations <ArrowUpRight size={13} />
                      </a>
                    }
                  >
                    <ul className="status-list">
                      <li>
                        <span>Stripe online payments</span>
                        <b
                          className={
                            data.integrations.stripe.configured
                              ? "pill pill-ok"
                              : "pill"
                          }
                        >
                          {data.integrations.stripe.configured
                            ? `Ready · ${data.integrations.stripe.mode} mode`
                            : "Not set up"}
                        </b>
                      </li>
                      <li>
                        <span>QuickBooks Online</span>
                        <b
                          className={
                            data.integrations.quickbooks.status === "connected"
                              ? "pill pill-ok"
                              : data.integrations.quickbooks.status ===
                                  "needs_reconnect"
                                ? "pill pill-warn"
                                : "pill"
                          }
                        >
                          {data.integrations.quickbooks.status === "connected"
                            ? (data.integrations.quickbooks.companyName ??
                              "Connected")
                            : data.integrations.quickbooks.status ===
                                "needs_reconnect"
                              ? "Reconnect needed"
                              : data.integrations.quickbooks.configured
                                ? "Ready to connect"
                                : "Needs app keys"}
                        </b>
                      </li>
                    </ul>
                    <label className="dash-check">
                      <input
                        type="checkbox"
                        checked={excluded}
                        onChange={toggleExclusion}
                      />
                      <span>Don't count my own visits from this browser</span>
                    </label>
                  </Panel>
                </div>
                <p className="dash-foot-note">
                  Statistics are first-party, cookie-free daily totals (
                  {formatDay(data.period.start)} – {formatDay(data.period.end)},
                  Winnipeg time). Visits count browser sessions; known bots are
                  excluded.
                </p>
              </>
            )}
            {tab === "reports" && <ReportsTab data={data} />}
          </div>
        </>
      )}
    </AdminFrame>
  );
}
