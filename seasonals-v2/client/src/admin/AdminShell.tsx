/**
 * HANDOFF: Admin layout: collapsible sidebar (state in localStorage 'ss-admin-sidebar'), breadcrumb top bar, alerts bell
 * (GET /api/admin/alerts) and Sign out (POST /api/admin/logout). To add a page: extend NAV and AdminSection, then route it in AdminApp.tsx.
 */
import React, { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  Bell,
  CreditCard,
  FileText,
  Inbox,
  LayoutDashboard,
  ListChecks,
  PanelLeftClose,
  PanelLeftOpen,
  Plug,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Brand } from "../Brand";
import { startLogin } from "../const";
import { ApiError, api } from "./api";

export type AdminSection =
  | "overview"
  | "leads"
  | "customers"
  | "followups"
  | "content"
  | "payments"
  | "integrations";

const NAV: Array<{
  id: AdminSection;
  href: string;
  label: string;
  icon: typeof Inbox;
}> = [
  { id: "overview", href: "/admin", label: "Overview", icon: LayoutDashboard },
  { id: "leads", href: "/admin/leads", label: "Leads", icon: Inbox },
  {
    id: "customers",
    href: "/admin/customers",
    label: "Customers",
    icon: Users,
  },
  {
    id: "followups",
    href: "/admin/follow-ups",
    label: "Follow-ups",
    icon: ListChecks,
  },
  { id: "content", href: "/admin/content", label: "Content", icon: FileText },
  {
    id: "payments",
    href: "/admin/payments",
    label: "Payments",
    icon: CreditCard,
  },
  {
    id: "integrations",
    href: "/admin/integrations",
    label: "Integrations",
    icon: Plug,
  },
];

type Access =
  | { state: "checking" }
  | { state: "allowed"; name: string }
  | { state: "denied"; status: 401 | 403 }
  | { state: "error"; message: string };

let cachedAccess: Promise<Access> | null = null;

function loadAccess(): Promise<Access> {
  cachedAccess ??= api<{ name: string }>("/api/admin/me")
    .then(me => ({ state: "allowed", name: me.name }) as Access)
    .catch(error => {
      cachedAccess = null;
      if (
        error instanceof ApiError &&
        (error.status === 401 || error.status === 403)
      )
        return { state: "denied", status: error.status } as Access;
      return {
        state: "error",
        message:
          error instanceof Error
            ? error.message
            : "The dashboard could not be reached.",
      } as Access;
    });
  return cachedAccess;
}

function useAccess() {
  const [access, setAccess] = useState<Access>({ state: "checking" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void loadAccess().then(result => {
      if (active) setAccess(result);
    });
    return () => {
      active = false;
    };
  }, [attempt]);
  return { access, retry: () => setAttempt(value => value + 1) };
}

export function OwnerAccessGate({
  access,
  retry,
}: {
  access: Access;
  retry: () => void;
}) {
  if (access.state === "checking")
    return (
      <div className="admin-state">
        <span className="loader-dot" /> Checking owner access…
      </div>
    );
  if (access.state === "denied" && access.status === 403)
    return (
      <div className="admin-state admin-denied">
        <ShieldCheck size={26} />
        <h2>Owner access needs to be confirmed</h2>
        <p>
          We could not confirm owner access for this session. If you have
          already signed in, the website must be linked to your Manus owner
          account. Resetting a Google password will not grant dashboard access.
        </p>
        <button className="button button-primary" type="button" onClick={retry}>
          Check access again
        </button>
        <p>
          <a href="/">Back to website</a>
        </p>
      </div>
    );
  if (access.state === "denied")
    return (
      <div className="admin-state admin-denied">
        <ShieldCheck size={26} />
        <h2>Sign in to manage Seasonal Solutions</h2>
        <p>
          Use the same Manus account you use for this website project. On the
          next screen, choose your usual sign-in method; Google is optional.
          Only the configured owner or an approved administrator can enter.
        </p>
        <button
          className="button button-primary"
          type="button"
          onClick={() => startLogin()}
        >
          Continue with Manus <ArrowUpRight size={16} />
        </button>
      </div>
    );
  if (access.state === "error")
    return (
      <div className="admin-state">
        <p>{access.message}</p>
        <button className="button button-outline" type="button" onClick={retry}>
          Try again
        </button>
      </div>
    );
  return null;
}

type AlertCounts = {
  newLeads: number;
  overdueFollowUps: number;
  openPaymentRequests: number;
  quickbooksNeedsReconnect: boolean;
  stripeConfigured: boolean;
};

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

function alertItems(counts: AlertCounts) {
  const items: Array<{ href: string; text: string; urgent: boolean }> = [];
  if (counts.newLeads > 0)
    items.push({
      href: "/admin/leads?status=new",
      text: `${plural(counts.newLeads, "new quote request")} waiting for a reply`,
      urgent: true,
    });
  if (counts.overdueFollowUps > 0)
    items.push({
      href: "/admin/follow-ups",
      text: `${plural(counts.overdueFollowUps, "follow-up")} overdue`,
      urgent: true,
    });
  if (counts.quickbooksNeedsReconnect)
    items.push({
      href: "/admin/integrations",
      text: "QuickBooks needs to be reconnected",
      urgent: true,
    });
  if (counts.openPaymentRequests > 0)
    items.push({
      href: "/admin/payments",
      text: `${plural(counts.openPaymentRequests, "payment link")} not paid yet`,
      urgent: false,
    });
  if (!counts.stripeConfigured)
    items.push({
      href: "/admin/integrations",
      text: "Online card payments are not set up",
      urgent: false,
    });
  return items;
}

function AlertsBell() {
  const [counts, setCounts] = useState<AlertCounts | null>(null);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    api<AlertCounts>("/api/admin/alerts")
      .then(result => active && setCounts(result))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (
        event instanceof KeyboardEvent
          ? event.key === "Escape"
          : !box.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const items = counts ? alertItems(counts) : [];
  const urgent = items.filter(item => item.urgent).length;
  return (
    <div className="dash-bell" ref={box}>
      <button
        type="button"
        className="dash-icon-button"
        aria-label={
          urgent ? `Alerts, ${urgent} need attention` : "Alerts, all clear"
        }
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
      >
        <Bell size={17} strokeWidth={1.8} />
        {urgent > 0 && <span className="dash-bell-dot">{urgent}</span>}
      </button>
      {open && (
        <div className="dash-popover" role="region" aria-label="Alerts">
          <h2>Needs your attention</h2>
          {items.length === 0 ? (
            <p className="dash-empty">Nothing is waiting on you right now.</p>
          ) : (
            <ul>
              {items.map(item => (
                <li key={item.text}>
                  <a href={item.href}>
                    <span
                      className={item.urgent ? "dot dot-urgent" : "dot"}
                      aria-hidden="true"
                    />
                    {item.text}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

async function signOut() {
  try {
    await api("/api/admin/logout", { method: "POST" });
  } catch {
    // Clear the local token and leave anyway.
  }
  try {
    sessionStorage.removeItem("manus-cookie");
  } catch {
    // Nothing stored.
  }
  window.location.assign("/");
}

function useCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("ss-admin-sidebar") === "collapsed";
    } catch {
      return false;
    }
  });
  const toggle = () =>
    setCollapsed(value => {
      try {
        localStorage.setItem("ss-admin-sidebar", value ? "open" : "collapsed");
      } catch {
        // Preference just won't persist.
      }
      return !value;
    });
  return { collapsed, toggle };
}

export function AdminFrame({
  current,
  title,
  description,
  actions,
  children,
}: {
  current: AdminSection;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { access, retry } = useAccess();
  const { collapsed, toggle } = useCollapsed();
  const section = NAV.find(item => item.id === current);
  return (
    <div className={`dash${collapsed ? " dash-collapsed" : ""}`}>
      <aside className="dash-sidebar" aria-label="Dashboard">
        <div className="dash-brand">
          <Brand light />
        </div>
        <nav className="dash-nav" aria-label="Dashboard sections">
          {NAV.map(item => {
            const Icon = item.icon;
            return (
              <a
                key={item.id}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={current === item.id ? "dash-nav-active" : ""}
                aria-current={current === item.id ? "page" : undefined}
              >
                <Icon size={17} strokeWidth={1.8} />
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>
        <div className="dash-sidebar-foot">
          <a href="/" title={collapsed ? "View website" : undefined}>
            <ArrowUpRight size={14} />
            <span>View website</span>
          </a>
        </div>
      </aside>
      <div className="dash-column">
        <div className="dash-topbar">
          <button
            type="button"
            className="dash-icon-button dash-collapse"
            onClick={toggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-pressed={collapsed}
          >
            {collapsed ? (
              <PanelLeftOpen size={17} strokeWidth={1.8} />
            ) : (
              <PanelLeftClose size={17} strokeWidth={1.8} />
            )}
          </button>
          <nav className="dash-crumbs" aria-label="Breadcrumb">
            <a href="/admin">Dashboard</a>
            {section && current !== "overview" && (
              <>
                <span aria-hidden="true">/</span>
                <span aria-current="page">{section.label}</span>
              </>
            )}
          </nav>
          <div className="dash-topbar-end">
            {access.state === "allowed" && (
              <>
                <AlertsBell />
                <span className="dash-user">{access.name}</span>
                <button
                  type="button"
                  className="link-button dash-signout"
                  onClick={signOut}
                >
                  Sign out
                </button>
              </>
            )}
          </div>
        </div>
        <main id="main" className="dash-main">
          <header className="dash-header">
            <div>
              <h1>{title}</h1>
              {description && <p>{description}</p>}
            </div>
            {access.state === "allowed" && actions && (
              <div className="dash-actions">{actions}</div>
            )}
          </header>
          {access.state === "allowed" ? (
            children
          ) : (
            <OwnerAccessGate access={access} retry={retry} />
          )}
        </main>
      </div>
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`dash-panel ${className}`}>
      {(title || action) && (
        <div className="dash-panel-head">
          {title && <h2>{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Notice({
  kind = "error",
  children,
}: {
  kind?: "error" | "success" | "info";
  children: ReactNode;
}) {
  if (!children) return null;
  return (
    <div
      className={`dash-notice dash-notice-${kind}`}
      role={kind === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
