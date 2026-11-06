import React from "react";
import { AdminCustomersPage, AdminFollowUpsPage } from "../CrmPages";
import { ContentPage } from "./ContentPage";
import { IntegrationsPage } from "./IntegrationsPage";
import { LeadsPage } from "./LeadsPage";
import { OverviewPage } from "./OverviewPage";
import { PaymentsPage } from "./PaymentsPage";

function UnknownDashboardPage() {
  return <OverviewPage />;
}

export function AdminApp() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/admin";
  if (path === "/admin") return <OverviewPage />;
  if (path === "/admin/leads") return <LeadsPage />;
  if (path === "/admin/customers") return <AdminCustomersPage />;
  if (path === "/admin/follow-ups") return <AdminFollowUpsPage />;
  if (path === "/admin/content") return <ContentPage />;
  if (path === "/admin/payments") return <PaymentsPage />;
  if (path === "/admin/integrations") return <IntegrationsPage />;
  return <UnknownDashboardPage />;
}
