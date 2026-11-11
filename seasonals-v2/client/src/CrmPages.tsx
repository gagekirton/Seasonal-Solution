import React, {
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Download,
  Mail,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { SERVICES } from "../../shared/site";
import { Brand } from "./Brand";
import { startLogin } from "./const";
import { downloadPrivateCsv } from "./adminDownloads";
import { AdminFrame as DashboardFrame } from "./admin/AdminShell";

type Access = "checking" | "denied" | "allowed" | "error";
type Overview = {
  customerCount: number;
  repeatCustomerCount: number;
  bookedValue: number;
  collectedValue: number;
  openFollowUpCount: number;
  overdueFollowUpCount: number;
};
type CustomerSummary = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  serviceArea: string | null;
  firstContactAt: string;
  lastContactAt: string;
  marketingConsentAt: string | null;
  marketingConsentSource: string | null;
  marketingConsentVersion: string | null;
  marketingOptOutAt: string | null;
  jobCount: number;
  completedJobCount: number;
  bookedValue: number;
  collectedValue: number;
};
type LeadRecord = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  service: string;
  area: string | null;
  projectType: string;
  details: string;
  status: string;
  createdAt: string;
  landingPath: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
};
type PaymentRecord = {
  id: string;
  kind: "payment" | "refund";
  source: "manual" | "stripe";
  amount: string | number;
  currency: string;
  recordedAt: string;
  reference: string | null;
  note: string | null;
};
type JobRecord = {
  id: string;
  customerId: string;
  leadId: number | null;
  service: string;
  summary: string;
  quotedAmount: string | null;
  bookedAmount: string | null;
  currency: string;
  status: "quoted" | "booked" | "in_progress" | "completed" | "cancelled";
  scheduledAt: string | null;
  completedAt: string | null;
  createdAt: string;
  payments: PaymentRecord[];
  collectedValue: number;
};
type FollowUpRecord = {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  leadId: number | null;
  jobId: string | null;
  type: "quote" | "service" | "seasonal";
  title: string;
  note: string | null;
  dueAt: string;
  status: "open" | "completed" | "cancelled";
  createdAt: string;
  completedAt: string | null;
};
type CustomerProfile = {
  customer: Omit<
    CustomerSummary,
    "jobCount" | "completedJobCount" | "bookedValue" | "collectedValue"
  > & {
    createdAt: string;
    updatedAt: string;
  };
  metrics: Pick<
    CustomerSummary,
    "jobCount" | "completedJobCount" | "bookedValue" | "collectedValue"
  >;
  leads: LeadRecord[];
  jobs: JobRecord[];
  followUps: FollowUpRecord[];
  consentHistory: Array<{
    id: string;
    kind: "opt_in" | "opt_out";
    occurredAt: string;
    source: string;
    wordingVersion: string | null;
    consentText: string | null;
  }>;
};

type ApiError = { error?: string };
type AccessState = {
  access: Access;
  message: string;
  overview: Overview | null;
};

function authHeaders(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem("app-session-token");
    const cookie = raw
      ?.split(";")
      .map(part => part.trim())
      .find(part => part.startsWith("webdev_app_session="));
    const token = cookie?.slice("webdev_app_session=".length);
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...authHeaders(),
    ...(init.headers as Record<string, string> | undefined),
  };
  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    credentials: "include",
    headers,
  });
  const body = (await response.json().catch(() => ({}))) as T & ApiError;
  if (!response.ok)
    throw new Error(
      body.error || "The private CRM request could not be completed."
    );
  return body;
}

function useAdminAccess(): AccessState {
  const [state, setState] = useState<AccessState>({
    access: "checking",
    message: "",
    overview: null,
  });
  useEffect(() => {
    let active = true;
    void api<{ overview: Overview }>("/api/admin/crm/overview")
      .then(result => {
        if (active)
          setState({
            access: "allowed",
            message: "",
            overview: result.overview,
          });
      })
      .catch(error => {
        if (!active) return;
        const message =
          error instanceof Error
            ? error.message
            : "The private CRM could not be reached.";
        setState({
          access:
            message === "Administrative access required." ? "denied" : "error",
          message,
          overview: null,
        });
      });
    return () => {
      active = false;
    };
  }, []);
  return state;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" });
}

function formatMoney(value: string | number | null | undefined): string {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(Number.isFinite(amount) ? amount : 0);
}

function serviceLabel(slug: string): string {
  return SERVICES.find(service => service.slug === slug)?.label ?? slug;
}

function AdminNav({
  current,
}: {
  current: "leads" | "customers" | "followups";
}) {
  return (
    <nav className="crm-nav" aria-label="Private business tools">
      <a
        className={current === "leads" ? "crm-nav-active" : ""}
        href="/admin/leads"
      >
        Leads
      </a>
      <a
        className={current === "customers" ? "crm-nav-active" : ""}
        href="/admin/customers"
      >
        Customers
      </a>
      <a
        className={current === "followups" ? "crm-nav-active" : ""}
        href="/admin/follow-ups"
      >
        Follow-ups
      </a>
    </nav>
  );
}

function AdminFrame({
  current,
  title,
  description,
  children,
}: {
  current: "leads" | "customers" | "followups";
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <DashboardFrame current={current} title={title} description={description}>
      {children}
    </DashboardFrame>
  );
}

function AccessMessage({
  state,
  retry,
}: {
  state: AccessState;
  retry?: () => void;
}) {
  if (state.access === "checking")
    return <div className="admin-state">Checking private access…</div>;
  if (state.access === "denied")
    return (
      <div className="admin-state admin-denied">
        <ShieldCheck size={24} />
        <h2>Sign in to manage the business</h2>
        <p>
          Lead and customer records are restricted to the configured owner
          identity or an explicitly granted administrator role. A Manus login
          alone does not grant access.
        </p>
        <button
          className="button button-primary"
          onClick={() => startLogin()}
          type="button"
        >
          Sign in with Manus <ArrowUpRight size={16} />
        </button>
      </div>
    );
  if (state.access === "error")
    return (
      <div className="admin-state">
        <p>{state.message}</p>
        {retry && (
          <button
            className="button button-outline"
            onClick={retry}
            type="button"
          >
            Try again
          </button>
        )}
      </div>
    );
  return null;
}

function OverviewCards({ overview }: { overview: Overview | null }) {
  if (!overview) return null;
  return (
    <section className="crm-metrics" aria-label="Business relationship summary">
      <article>
        <small>CUSTOMERS</small>
        <b>{overview.customerCount}</b>
        <span>Profiles linked by email</span>
      </article>
      <article>
        <small>REPEAT CUSTOMERS</small>
        <b>{overview.repeatCustomerCount}</b>
        <span>Two or more completed jobs</span>
      </article>
      <article>
        <small>BOOKED VALUE</small>
        <b>{formatMoney(overview.bookedValue)}</b>
        <span>Accepted jobs, excluding cancellations</span>
      </article>
      <article>
        <small>COLLECTED, NET</small>
        <b>{formatMoney(overview.collectedValue)}</b>
        <span>Recorded payments less refunds</span>
      </article>
      <article>
        <small>OPEN FOLLOW-UPS</small>
        <b>{overview.openFollowUpCount}</b>
        <span>{overview.overdueFollowUpCount} overdue</span>
      </article>
    </section>
  );
}

function ErrorNotice({ message }: { message: string }) {
  const success =
    /^(Customer details saved|Marketing opt-out recorded|Service job added|Payment recorded|Refund recorded|Internal follow-up task added)\.$/.test(
      message
    );
  return message ? (
    <div
      className={`form-message ${success ? "form-success" : "form-error"}`}
      role={success ? "status" : "alert"}
    >
      {message}
    </div>
  ) : null;
}

function CustomerCards({
  customers,
  onSelect,
}: {
  customers: CustomerSummary[];
  onSelect: (id: string) => void;
}) {
  if (customers.length === 0)
    return (
      <div className="empty-inbox">
        <UserRound size={28} />
        <h2>No matching customers</h2>
        <p>
          New quote requests will create or update a customer profile
          automatically.
        </p>
      </div>
    );
  return (
    <div className="crm-customer-list">
      {customers.map(customer => (
        <button
          className="crm-customer-card"
          key={customer.id}
          onClick={() => onSelect(customer.id)}
          type="button"
        >
          <span className="crm-customer-icon">
            <UserRound size={19} />
          </span>
          <span className="crm-customer-main">
            <b>{customer.name}</b>
            <small>{customer.email}</small>
            <span className="crm-customer-id">{customer.id}</span>
          </span>
          <span className="crm-customer-stats">
            <b>{formatMoney(customer.collectedValue)}</b>
            <small>collected · {customer.completedJobCount} completed</small>
            <small>Last contact {formatDate(customer.lastContactAt)}</small>
          </span>
          <ChevronRight size={17} />
        </button>
      ))}
    </div>
  );
}

function CustomerList({ onSelect }: { onSelect: (id: string) => void }) {
  const access = useAdminAccess();
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [exporting, setExporting] = useState(false);
  useEffect(() => {
    if (access.access !== "allowed") return;
    let active = true;
    setLoading(true);
    void api<{ customers: CustomerSummary[] }>(
      `/api/admin/crm/customers?search=${encodeURIComponent(search)}`
    )
      .then(result => {
        if (active) {
          setCustomers(result.customers);
          setMessage("");
        }
      })
      .catch(error => {
        if (active)
          setMessage(
            error instanceof Error
              ? error.message
              : "Customer records could not be loaded."
          );
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [access.access, search]);
  async function exportCustomers() {
    setExporting(true);
    setMessage("");
    try {
      await downloadPrivateCsv(
        "/api/admin/crm/customers.csv",
        "seasonal-solutions-customers.csv"
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Customer export could not be downloaded."
      );
    } finally {
      setExporting(false);
    }
  }
  return (
    <AdminFrame
      current="customers"
      title="Customer book"
      description="Follow service history and the real value of repeat work."
    >
      <AccessMessage state={access} />
      {access.access === "allowed" && (
        <>
          <OverviewCards overview={access.overview} />
          <div className="crm-toolbar">
            <form
              className="crm-search"
              onSubmit={event => {
                event.preventDefault();
                setSearch(searchText.trim());
              }}
            >
              <label htmlFor="crm-customer-search">
                Search customers by name, email, phone or ID
              </label>
              <div>
                <input
                  id="crm-customer-search"
                  value={searchText}
                  onChange={event => setSearchText(event.target.value)}
                  placeholder="Name, email or customer ID"
                />
                <button className="button button-primary" type="submit">
                  <Search size={16} /> Search
                </button>
              </div>
            </form>
            <button
              className="button button-outline"
              disabled={exporting}
              onClick={() => void exportCustomers()}
              type="button"
            >
              <Download size={15} />{" "}
              {exporting ? "Preparing export…" : "Export customers"}
            </button>
          </div>
          <ErrorNotice message={message} />
          {loading ? (
            <div className="admin-state">Loading customer profiles…</div>
          ) : (
            <>
              <p className="crm-list-note">
                Showing up to 200 most recently contacted profiles. Search to
                find older records.
              </p>
              <CustomerCards customers={customers} onSelect={onSelect} />
            </>
          )}
        </>
      )}
    </AdminFrame>
  );
}

function CustomerEditor({
  profile,
  onRefresh,
}: {
  profile: CustomerProfile;
  onRefresh: () => void;
}) {
  const { customer, metrics } = profile;
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [serviceArea, setServiceArea] = useState(customer.serviceArea ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [consentBusy, setConsentBusy] = useState(false);
  useEffect(() => {
    setName(customer.name);
    setPhone(customer.phone ?? "");
    setServiceArea(customer.serviceArea ?? "");
  }, [customer.id, customer.name, customer.phone, customer.serviceArea]);
  const returning = metrics.completedJobCount >= 2;
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await api(`/api/admin/crm/customers/${encodeURIComponent(customer.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone: phone || null,
          serviceArea: serviceArea || null,
        }),
      });
      setMessage("Customer details saved.");
      onRefresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Customer details could not be saved."
      );
    } finally {
      setSaving(false);
    }
  }
  async function optOut() {
    setConsentBusy(true);
    setMessage("");
    try {
      await api(
        `/api/admin/crm/customers/${encodeURIComponent(customer.id)}/marketing-opt-out`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );
      setMessage("Marketing opt-out recorded.");
      onRefresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Opt-out could not be recorded."
      );
    } finally {
      setConsentBusy(false);
    }
  }
  return (
    <>
      <section
        className="crm-metrics crm-profile-metrics"
        aria-label="Customer value summary"
      >
        <article>
          <small>CUSTOMER ID</small>
          <b className="crm-id-value">{customer.id}</b>
          <span>Stable internal record key</span>
        </article>
        <article>
          <small>BOOKED VALUE</small>
          <b>{formatMoney(metrics.bookedValue)}</b>
          <span>Excludes quotes and cancellations</span>
        </article>
        <article>
          <small>COLLECTED, NET</small>
          <b>{formatMoney(metrics.collectedValue)}</b>
          <span>Payments minus refunds</span>
        </article>
        <article>
          <small>WORK HISTORY</small>
          <b>{metrics.jobCount} jobs</b>
          <span>
            {returning
              ? "Returning customer"
              : metrics.completedJobCount === 1
                ? "1 completed job"
                : "No completed jobs"}
          </span>
        </article>
      </section>
      <div className="crm-detail-layout">
        <section className="crm-panel">
          <div className="crm-panel-heading">
            <div>
              <span>CONTACT RECORD</span>
              <h2>Customer details</h2>
            </div>
          </div>
          <form className="crm-form" onSubmit={save}>
            <label>
              Name
              <input
                required
                minLength={2}
                maxLength={100}
                value={name}
                onChange={event => setName(event.target.value)}
              />
            </label>
            <label>
              Email
              <input type="email" value={customer.email} readOnly />
            </label>
            <label>
              Phone
              <input
                maxLength={40}
                type="tel"
                value={phone}
                onChange={event => setPhone(event.target.value)}
              />
            </label>
            <label>
              Service area
              <input
                maxLength={120}
                value={serviceArea}
                onChange={event => setServiceArea(event.target.value)}
                placeholder="Neighbourhood or community"
              />
            </label>
            <div className="crm-form-meta">
              <span>First contact: {formatDate(customer.firstContactAt)}</span>
              <span>Last contact: {formatDate(customer.lastContactAt)}</span>
            </div>
            <button
              className="button button-primary"
              disabled={saving}
              type="submit"
            >
              {saving ? "Saving…" : "Save details"} <Check size={15} />
            </button>
          </form>
          <ErrorNotice message={message} />
        </section>
        <section className="crm-panel crm-consent-panel">
          <div className="crm-panel-heading">
            <div>
              <span>EMAIL PERMISSION</span>
              <h2>Marketing consent</h2>
            </div>
          </div>
          {customer.marketingConsentAt ? (
            <p className="crm-consent-status crm-consent-yes">
              Opted in on {formatDate(customer.marketingConsentAt)} ·{" "}
              {customer.marketingConsentSource} ·{" "}
              {customer.marketingConsentVersion}
            </p>
          ) : (
            <p className="crm-consent-status">
              No marketing opt-in is recorded. Quote requests do not imply
              permission.
            </p>
          )}
          {customer.marketingOptOutAt && (
            <p className="crm-consent-status crm-consent-no">
              Opt-out recorded on {formatDate(customer.marketingOptOutAt)}.
            </p>
          )}
          <p className="crm-note">
            This website does not send marketing email or text. Record an
            opt-out here if the customer asks to stop future marketing.
          </p>
          {!customer.marketingOptOutAt && customer.marketingConsentAt && (
            <button
              className="button button-outline"
              disabled={consentBusy}
              onClick={() => void optOut()}
              type="button"
            >
              {consentBusy ? "Recording…" : "Record opt-out"}
            </button>
          )}
          {profile.consentHistory.length > 0 && (
            <div className="crm-mini-task-list">
              <p className="crm-note">
                Permission history is retained, including withdrawals and later
                opt-ins.
              </p>
              {profile.consentHistory.map(event => (
                <div key={event.id}>
                  <b>
                    {event.kind === "opt_in"
                      ? "Opt-in recorded"
                      : "Opt-out recorded"}
                  </b>
                  <span>
                    {formatDate(event.occurredAt)} · {event.source}
                    {event.wordingVersion ? ` · ${event.wordingVersion}` : ""}
                  </span>
                  {event.consentText && <span>{event.consentText}</span>}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function CreateJobForm({
  customerId,
  leads,
  onCreated,
}: {
  customerId: string;
  leads: LeadRecord[];
  onCreated: () => void;
}) {
  const [service, setService] = useState(leads[0]?.service ?? SERVICES[0].slug);
  const [leadId, setLeadId] = useState(leads[0] ? String(leads[0].id) : "");
  const [summary, setSummary] = useState("");
  const [quotedAmount, setQuotedAmount] = useState("");
  const [bookedAmount, setBookedAmount] = useState("");
  const [status, setStatus] = useState<JobRecord["status"]>("quoted");
  const [scheduledAt, setScheduledAt] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (status === "quoted" || status === "cancelled") setBookedAmount("");
  }, [status]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await api("/api/admin/crm/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          leadId: leadId ? Number(leadId) : null,
          service,
          summary,
          quotedAmount: quotedAmount ? Number(quotedAmount) : null,
          bookedAmount:
            status !== "quoted" && status !== "cancelled" && bookedAmount
              ? Number(bookedAmount)
              : null,
          status,
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        }),
      });
      setSummary("");
      setMessage("Service job added.");
      onCreated();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Job could not be saved."
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <form className="crm-form crm-job-form" onSubmit={submit}>
      <div className="crm-fields-two">
        <label>
          Service
          <select
            value={service}
            onChange={event => setService(event.target.value)}
          >
            {SERVICES.map(item => (
              <option key={item.slug} value={item.slug}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Linked inquiry
          <select
            value={leadId}
            onChange={event => setLeadId(event.target.value)}
          >
            <option value="">No linked inquiry</option>
            {leads.map(lead => (
              <option key={lead.id} value={lead.id}>
                #{lead.id} · {formatDate(lead.createdAt)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Quote amount (CAD)
          <input
            type="number"
            min="0"
            max="9999999.99"
            step="0.01"
            value={quotedAmount}
            onChange={event => setQuotedAmount(event.target.value)}
            placeholder="Optional"
          />
        </label>
        <label>
          Accepted/booked amount (CAD)
          <input
            type="number"
            min="0"
            max="9999999.99"
            step="0.01"
            value={bookedAmount}
            disabled={status === "quoted" || status === "cancelled"}
            onChange={event => setBookedAmount(event.target.value)}
            placeholder={
              status === "quoted"
                ? "Choose an accepted status first"
                : "Optional"
            }
          />
        </label>
        <label>
          Status
          <select
            value={status}
            onChange={event =>
              setStatus(event.target.value as JobRecord["status"])
            }
          >
            <option value="quoted">Quoted</option>
            <option value="booked">Booked</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <label>
          Scheduled date
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={event => setScheduledAt(event.target.value)}
          />
        </label>
        <label className="crm-full-field">
          Scope summary
          <textarea
            required
            minLength={2}
            maxLength={2000}
            rows={3}
            value={summary}
            onChange={event => setSummary(event.target.value)}
            placeholder="What work is included? Avoid card numbers or sensitive personal information."
          />
        </label>
      </div>
      <div className="crm-form-actions">
        <button
          className="button button-primary"
          disabled={saving}
          type="submit"
        >
          <Plus size={15} /> {saving ? "Saving…" : "Add service job"}
        </button>
        <ErrorNotice message={message} />
      </div>
    </form>
  );
}

function JobTermsForm({
  job,
  onRefresh,
}: {
  job: JobRecord;
  onRefresh: () => void;
}) {
  const [quoted, setQuoted] = useState(job.quotedAmount ?? "");
  const [booked, setBooked] = useState(job.bookedAmount ?? "");
  const [schedule, setSchedule] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const accepted = ["booked", "in_progress", "completed"].includes(job.status);
  useEffect(() => {
    setQuoted(job.quotedAmount ?? "");
    setBooked(job.bookedAmount ?? "");
    if (!job.scheduledAt) {
      setSchedule("");
      return;
    }
    const date = new Date(job.scheduledAt);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    setSchedule(date.toISOString().slice(0, 16));
  }, [job.quotedAmount, job.bookedAmount, job.scheduledAt]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/admin/crm/jobs/${encodeURIComponent(job.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: job.status,
          quotedAmount: quoted ? Number(quoted) : null,
          ...(accepted ? { bookedAmount: booked ? Number(booked) : null } : {}),
          scheduledAt: schedule ? new Date(schedule).toISOString() : null,
        }),
      });
      onRefresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Job amounts could not be updated."
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="crm-payment-form" onSubmit={save}>
      <b>Edit quote, accepted amount and schedule</b>
      <p>
        Accepted amounts require a booked, in-progress or completed job.
        Changing back to quoted clears the accepted amount, not recorded
        payments.
      </p>
      <div className="crm-fields-three">
        <label>
          Quote amount (CAD)
          <input
            type="number"
            min="0"
            max="9999999.99"
            step="0.01"
            value={quoted}
            onChange={event => setQuoted(event.target.value)}
          />
        </label>
        <label>
          Accepted amount (CAD)
          <input
            type="number"
            min="0"
            max="9999999.99"
            step="0.01"
            disabled={!accepted}
            value={booked}
            onChange={event => setBooked(event.target.value)}
          />
        </label>
        <label>
          Scheduled date
          <input
            type="datetime-local"
            value={schedule}
            onChange={event => setSchedule(event.target.value)}
          />
        </label>
      </div>
      <button className="button button-outline" disabled={busy} type="submit">
        {busy ? "Saving…" : "Save job details"}
      </button>
      <ErrorNotice message={error} />
    </form>
  );
}

function JobCard({
  job,
  onRefresh,
}: {
  job: JobRecord;
  onRefresh: () => void;
}) {
  const [kind, setKind] = useState<"payment" | "refund">("payment");
  const [refundSource, setRefundSource] = useState<"manual" | "stripe">(
    "manual"
  );
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function changeStatus(status: JobRecord["status"]) {
    setBusy(true);
    setMessage("");
    try {
      await api(`/api/admin/crm/jobs/${encodeURIComponent(job.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      onRefresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Job status could not be updated."
      );
    } finally {
      setBusy(false);
    }
  }
  async function recordEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!amount || Number(amount) <= 0) return;
    setBusy(true);
    setMessage("");
    try {
      await api(`/api/admin/crm/jobs/${encodeURIComponent(job.id)}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          ...(kind === "refund" ? { source: refundSource } : {}),
          amount: Number(amount),
          reference: reference || null,
          note: note || null,
        }),
      });
      setAmount("");
      setReference("");
      setNote("");
      setMessage(`${kind === "payment" ? "Payment" : "Refund"} recorded.`);
      onRefresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Payment entry could not be saved."
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="crm-job-card">
      <div className="crm-job-heading">
        <div>
          <span
            className={`lead-status status-${job.status === "completed" ? "closed" : job.status === "cancelled" ? "closed" : job.status === "quoted" ? "new" : "contacted"}`}
          >
            {job.status.replace("_", " ")}
          </span>
          <h3>{serviceLabel(job.service)}</h3>
          <p>{job.summary}</p>
        </div>
        <div className="crm-job-value">
          <small>BOOKED</small>
          <b>
            {formatMoney(
              ["booked", "in_progress", "completed"].includes(job.status)
                ? job.bookedAmount
                : 0
            )}
          </b>
          <small>COLLECTED, NET</small>
          <b>{formatMoney(job.collectedValue)}</b>
        </div>
      </div>
      <div className="crm-job-meta">
        <span>Quote {formatMoney(job.quotedAmount)}</span>
        <span>Created {formatDate(job.createdAt)}</span>
        <span>
          {job.scheduledAt
            ? `Scheduled ${formatDate(job.scheduledAt)}`
            : "No schedule set"}
        </span>
      </div>
      <label className="status-control">
        Update job status{" "}
        <select
          disabled={busy}
          value={job.status}
          onChange={event =>
            void changeStatus(event.target.value as JobRecord["status"])
          }
        >
          <option value="quoted">Quoted</option>
          <option value="booked">Booked</option>
          <option value="in_progress">In progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </label>
      <JobTermsForm job={job} onRefresh={onRefresh} />
      <div className="crm-job-integrations">
        <a
          className="button button-outline button-small"
          href={`/admin/payments?job=${encodeURIComponent(job.id)}`}
        >
          Request online payment <ArrowUpRight size={14} />
        </a>
        <a
          className="button button-outline button-small"
          href={`/admin/integrations?sync=invoice&id=${encodeURIComponent(job.id)}`}
        >
          Sync QuickBooks invoice <ArrowUpRight size={14} />
        </a>
      </div>
      {job.payments.length > 0 && (
        <div className="crm-payment-list">
          <b>Payment history</b>
          {job.payments.map(payment => (
            <div className="crm-payment-row" key={payment.id}>
              <span className={payment.kind === "refund" ? "crm-refund" : ""}>
                {payment.kind === "refund" ? "Refund" : "Payment"} ·{" "}
                {payment.source === "stripe" ? "Stripe" : "Offline"} ·{" "}
                {formatDate(payment.recordedAt)}
                {payment.reference ? ` · ${payment.reference}` : ""}
                {payment.note ? ` · ${payment.note}` : ""}
              </span>
              <strong>
                {payment.kind === "refund" ? "−" : ""}
                {formatMoney(payment.amount)}
              </strong>
              {payment.kind === "payment" && (
                <a
                  className="crm-accounting-link"
                  href={`/admin/integrations?sync=payment&id=${encodeURIComponent(payment.id)}`}
                >
                  Sync accounting
                </a>
              )}
            </div>
          ))}
        </div>
      )}
      <form className="crm-payment-form" onSubmit={recordEntry}>
        <b>Record a received payment or refund</b>
        <p>
          This is a manual business record only. No payment is charged or card
          details are requested; likely payment credentials in text are
          rejected.
        </p>
        <div className="crm-fields-three">
          <label>
            Entry type
            <select
              value={kind}
              onChange={event =>
                setKind(event.target.value as "payment" | "refund")
              }
            >
              <option value="payment">Payment received</option>
              <option value="refund">Refund issued</option>
            </select>
          </label>
          {kind === "refund" && (
            <label>
              Original payment channel
              <select
                value={refundSource}
                onChange={event =>
                  setRefundSource(event.target.value as "manual" | "stripe")
                }
              >
                <option value="manual">Offline / manually received</option>
                <option value="stripe">Stripe online payment</option>
              </select>
              <small>
                This only records a refund already issued. It does not send
                money.
              </small>
            </label>
          )}
          <label>
            Amount (CAD)
            <input
              type="number"
              min="0.01"
              max="9999999.99"
              step="0.01"
              required
              value={amount}
              onChange={event => setAmount(event.target.value)}
            />
          </label>
          <label>
            Reference (optional)
            <input
              maxLength={120}
              value={reference}
              onChange={event => setReference(event.target.value)}
              placeholder="Receipt or reference"
            />
          </label>
          <label className="crm-full-field">
            Note (optional)
            <input
              maxLength={1000}
              value={note}
              onChange={event => setNote(event.target.value)}
              placeholder="Do not enter card or bank details"
            />
          </label>
        </div>
        <button className="button button-outline" disabled={busy} type="submit">
          {busy
            ? "Saving…"
            : kind === "payment"
              ? "Record payment"
              : "Record refund"}
        </button>
        <ErrorNotice message={message} />
      </form>
    </article>
  );
}

function AddFollowUpForm({
  customerId,
  leads,
  jobs,
  hasMarketingConsent,
  onCreated,
}: {
  customerId: string;
  leads: LeadRecord[];
  jobs: JobRecord[];
  hasMarketingConsent: boolean;
  onCreated: () => void;
}) {
  const [type, setType] = useState<"quote" | "service" | "seasonal">("quote");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [leadId, setLeadId] = useState("");
  const [jobId, setJobId] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!hasMarketingConsent && type === "seasonal") setType("quote");
  }, [hasMarketingConsent, type]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await api("/api/admin/crm/follow-ups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          leadId: leadId ? Number(leadId) : null,
          jobId: jobId || null,
          type,
          title,
          note: note || null,
          dueAt: new Date(`${dueDate}T12:00:00`).toISOString(),
        }),
      });
      setTitle("");
      setNote("");
      setMessage("Internal follow-up task added.");
      onCreated();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Follow-up task could not be saved."
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <form className="crm-form crm-job-form" onSubmit={submit}>
      <div className="crm-fields-two">
        <label>
          Task type
          <select
            value={type}
            onChange={event => setType(event.target.value as typeof type)}
          >
            <option value="quote">Quote response</option>
            <option value="service">Service follow-up</option>
            <option disabled={!hasMarketingConsent} value="seasonal">
              Seasonal or promotional
              {hasMarketingConsent ? "" : " (opt-in required)"}
            </option>
          </select>
        </label>
        <label>
          Due date
          <input
            required
            type="date"
            value={dueDate}
            onChange={event => setDueDate(event.target.value)}
          />
        </label>
        <label>
          Related inquiry
          <select
            value={leadId}
            onChange={event => setLeadId(event.target.value)}
          >
            <option value="">No linked inquiry</option>
            {leads.map(lead => (
              <option key={lead.id} value={lead.id}>
                #{lead.id} · {formatDate(lead.createdAt)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Related job
          <select
            value={jobId}
            onChange={event => setJobId(event.target.value)}
          >
            <option value="">No linked job</option>
            {jobs.map(job => (
              <option key={job.id} value={job.id}>
                {serviceLabel(job.service)} · {job.status}
              </option>
            ))}
          </select>
        </label>
        <label className="crm-full-field">
          Task title
          <input
            required
            minLength={2}
            maxLength={140}
            value={title}
            onChange={event => setTitle(event.target.value)}
            placeholder="e.g., Check in about the estimate"
          />
        </label>
        <label className="crm-full-field">
          Private note <span className="optional">Optional</span>
          <textarea
            maxLength={1000}
            rows={2}
            value={note}
            onChange={event => setNote(event.target.value)}
            placeholder="A brief internal reminder; avoid sensitive personal or payment details"
          />
        </label>
      </div>
      <div className="crm-form-actions">
        <button
          className="button button-primary"
          disabled={saving}
          type="submit"
        >
          <Plus size={15} /> {saving ? "Saving…" : "Add internal reminder"}
        </button>
        <ErrorNotice message={message} />
      </div>
      <p className="crm-note">
        No email, SMS or campaign is sent. Seasonal or promotional reminders
        require a current recorded opt-in.
      </p>
    </form>
  );
}

function CustomerDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const access = useAdminAccess();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);
  const refresh = () => setRevision(value => value + 1);
  useEffect(() => {
    let active = true;
    if (access.access !== "allowed") {
      setLoading(access.access === "checking");
      return () => {
        active = false;
      };
    }
    setLoading(true);
    void api<{ profile: CustomerProfile }>(
      `/api/admin/crm/customers/${encodeURIComponent(id)}`
    )
      .then(result => {
        if (active) {
          setProfile(result.profile);
          setMessage("");
        }
      })
      .catch(error => {
        if (active)
          setMessage(
            error instanceof Error
              ? error.message
              : "Customer record could not be loaded."
          );
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id, revision, access.access]);
  if (access.access !== "allowed") return <AccessMessage state={access} />;
  if (loading)
    return <div className="admin-state">Loading customer history…</div>;
  if (!profile)
    return (
      <div className="admin-state">
        <ErrorNotice message={message || "Customer not found."} />
        <button
          className="button button-outline"
          onClick={onBack}
          type="button"
        >
          <ArrowLeft size={15} /> Customer list
        </button>
      </div>
    );
  return (
    <>
      <button className="crm-back" onClick={onBack} type="button">
        <ArrowLeft size={15} /> All customers
      </button>
      <ErrorNotice message={message} />
      <CustomerEditor profile={profile} onRefresh={refresh} />
      <section className="crm-panel crm-section-panel">
        <div className="crm-panel-heading">
          <div>
            <span>SERVICE HISTORY</span>
            <h2>Jobs and recorded revenue</h2>
          </div>
          <BriefcaseBusiness size={20} />
        </div>
        <p className="crm-note">
          Quoted amounts, accepted work and money actually collected are tracked
          separately. Collected value is net of refunds and is not profit.
        </p>
        <CreateJobForm
          customerId={id}
          leads={profile.leads}
          onCreated={refresh}
        />
        {profile.jobs.length === 0 ? (
          <p className="crm-empty-note">
            No service jobs recorded yet. Add a job after the scope and quote
            are discussed.
          </p>
        ) : (
          <div className="crm-job-list">
            {profile.jobs.map(job => (
              <JobCard key={job.id} job={job} onRefresh={refresh} />
            ))}
          </div>
        )}
      </section>
      <div className="crm-detail-layout">
        <section className="crm-panel crm-section-panel">
          <div className="crm-panel-heading">
            <div>
              <span>RETENTION WORKFLOW</span>
              <h2>Follow-up reminders</h2>
            </div>
            <CalendarDays size={20} />
          </div>
          <AddFollowUpForm
            customerId={id}
            leads={profile.leads}
            jobs={profile.jobs}
            hasMarketingConsent={Boolean(
              profile.customer.marketingConsentAt &&
                !profile.customer.marketingOptOutAt
            )}
            onCreated={refresh}
          />
          {profile.followUps.length > 0 && (
            <div className="crm-mini-task-list">
              {profile.followUps.slice(0, 6).map(task => (
                <div key={task.id}>
                  <b>{task.title}</b>
                  <span>
                    {task.type} · due {formatDate(task.dueAt)} · {task.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="crm-panel crm-section-panel">
          <div className="crm-panel-heading">
            <div>
              <span>INQUIRY HISTORY</span>
              <h2>
                {profile.leads.length} quote{" "}
                {profile.leads.length === 1 ? "request" : "requests"}
              </h2>
            </div>
            <Mail size={20} />
          </div>
          {profile.leads.length === 0 ? (
            <p className="crm-empty-note">
              No online quote requests are linked to this customer yet.
            </p>
          ) : (
            <div className="crm-inquiry-list">
              {profile.leads.map(lead => (
                <article key={lead.id}>
                  <header>
                    <span className={`lead-status status-${lead.status}`}>
                      {lead.status}
                    </span>
                    <time>{formatDate(lead.createdAt)}</time>
                  </header>
                  <b>
                    {serviceLabel(lead.service)} · {lead.projectType}
                  </b>
                  <p>{lead.details}</p>
                  <span>{lead.area || "Area not specified"}</span>
                  {(lead.utmSource ||
                    lead.utmMedium ||
                    lead.utmCampaign ||
                    lead.landingPath) && (
                    <small>
                      Source:{" "}
                      {[lead.utmSource, lead.utmMedium, lead.utmCampaign]
                        .filter(Boolean)
                        .join(" / ") || "direct"}
                      {lead.landingPath ? ` · ${lead.landingPath}` : ""}
                    </small>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

export function AdminCustomersPage() {
  const [selectedId, setSelectedId] = useState("");
  useEffect(() => {
    const id =
      new URLSearchParams(window.location.search).get("customer") || "";
    setSelectedId(id);
  }, []);
  const selectCustomer = (id: string) => {
    setSelectedId(id);
    window.history.replaceState(
      null,
      "",
      `/admin/customers?customer=${encodeURIComponent(id)}`
    );
  };
  const goBack = () => {
    setSelectedId("");
    window.history.replaceState(null, "", "/admin/customers");
  };
  if (selectedId)
    return (
      <AdminFrame
        current="customers"
        title="Customer profile"
        description="Service history, recorded value and next steps for one customer."
      >
        <CustomerDetail id={selectedId} onBack={goBack} />
      </AdminFrame>
    );
  return <CustomerList onSelect={selectCustomer} />;
}

export function AdminFollowUpsPage() {
  const access = useAdminAccess();
  const [status, setStatus] = useState<
    "open" | "overdue" | "completed" | "cancelled" | "all"
  >("open");
  const [tasks, setTasks] = useState<FollowUpRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (access.access !== "allowed") return;
    let active = true;
    setLoading(true);
    void api<{ followUps: FollowUpRecord[] }>(
      `/api/admin/crm/follow-ups?status=${status}`
    )
      .then(result => {
        if (active) {
          setTasks(result.followUps);
          setMessage("");
        }
      })
      .catch(error => {
        if (active)
          setMessage(
            error instanceof Error
              ? error.message
              : "Follow-ups could not be loaded."
          );
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [access.access, status, revision]);
  async function updateTask(
    id: string,
    nextStatus: "open" | "completed" | "cancelled"
  ) {
    setMessage("");
    try {
      await api(`/api/admin/crm/follow-ups/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      setRevision(value => value + 1);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Follow-up status could not be updated."
      );
    }
  }
  return (
    <AdminFrame
      current="followups"
      title="Follow-up list"
      description="Internal reminders for quote response, service care and permissioned seasonal outreach."
    >
      <AccessMessage state={access} />
      {access.access === "allowed" && (
        <>
          <OverviewCards overview={access.overview} />
          <div className="crm-toolbar crm-followup-toolbar">
            <div>
              <b>{access.overview?.openFollowUpCount ?? 0}</b> open ·{" "}
              <b>{access.overview?.overdueFollowUpCount ?? 0}</b> overdue
            </div>
            <label>
              Show tasks
              <select
                value={status}
                onChange={event =>
                  setStatus(event.target.value as typeof status)
                }
              >
                <option value="open">Open</option>
                <option value="overdue">Overdue only</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="all">All</option>
              </select>
            </label>
          </div>
          <ErrorNotice message={message} />
          {loading ? (
            <div className="admin-state">Loading follow-ups…</div>
          ) : tasks.length === 0 ? (
            <div className="empty-inbox">
              <Clock3 size={28} />
              <h2>No follow-up tasks</h2>
              <p>
                Create an internal reminder from a customer profile after a
                quote or job is reviewed.
              </p>
            </div>
          ) : (
            <div className="crm-task-list">
              {tasks.map(task => {
                const overdue =
                  task.status === "open" &&
                  new Date(task.dueAt).getTime() < Date.now();
                return (
                  <article className="crm-task-card" key={task.id}>
                    <div className="crm-task-main">
                      <span className={`crm-task-type task-${task.type}`}>
                        {task.type}
                      </span>
                      <h2>{task.title}</h2>
                      <a
                        href={`/admin/customers?customer=${encodeURIComponent(task.customerId)}`}
                      >
                        {task.customerName} · {task.customerEmail}
                      </a>
                      {task.note && <p>{task.note}</p>}
                      <span
                        className={overdue ? "crm-overdue" : "crm-due-date"}
                      >
                        <CalendarDays size={14} />{" "}
                        {overdue ? "Overdue · " : "Due · "}
                        {formatDate(task.dueAt)}
                      </span>
                    </div>
                    <div className="crm-task-actions">
                      {task.status === "open" ? (
                        <>
                          <button
                            className="button button-primary"
                            onClick={() =>
                              void updateTask(task.id, "completed")
                            }
                            type="button"
                          >
                            <Check size={15} /> Complete
                          </button>
                          <button
                            className="button button-outline"
                            onClick={() =>
                              void updateTask(task.id, "cancelled")
                            }
                            type="button"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          className="button button-outline"
                          onClick={() => void updateTask(task.id, "open")}
                          type="button"
                        >
                          Reopen
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          <p className="crm-note crm-followup-note">
            Tasks are reminders for the business only. The website does not send
            email, SMS, or marketing campaigns.
          </p>
        </>
      )}
    </AdminFrame>
  );
}
