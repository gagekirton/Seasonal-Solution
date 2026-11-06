/**
 * HANDOFF: Best-effort owner notifications via the Manus notification service (failures are swallowed).
 * Messages include customer names and contact details: keep them minimal and never include card data.
 */
import { SERVICES } from "../shared/site";
import { notifyOwner } from "./_core/notification";

function serviceLabel(slug: string) {
  return SERVICES.find(service => service.slug === slug)?.label ?? slug;
}

/** Sends the owner an alert; never throws so customer flows are unaffected. */
async function safeNotify(title: string, content: string) {
  try {
    await notifyOwner({
      title: title.slice(0, 200),
      content: content.slice(0, 4000),
    });
  } catch (error) {
    console.warn(
      "[Alerts] Owner notification failed:",
      error instanceof Error ? error.message : "unknown error"
    );
  }
}

export function alertNewLead(lead: {
  name: string;
  email: string;
  phone: string | null;
  service: string;
  area: string | null;
  projectType: string;
  details: string;
}) {
  const lines = [
    `Service: ${serviceLabel(lead.service)} (${lead.projectType})`,
    `Name: ${lead.name}`,
    `Email: ${lead.email}`,
    lead.phone ? `Phone: ${lead.phone}` : null,
    lead.area ? `Area: ${lead.area}` : null,
    "",
    lead.details.length > 700 ? `${lead.details.slice(0, 700)}…` : lead.details,
    "",
    "Open the dashboard: /admin/leads",
  ].filter(line => line !== null);
  void safeNotify(
    `New quote request: ${serviceLabel(lead.service)} — ${lead.name}`,
    lines.join("\n")
  );
}

export function alertPaymentReceived(payment: {
  customerName: string;
  amount: string;
  description: string;
}) {
  void safeNotify(
    `Online payment received: $${payment.amount} from ${payment.customerName}`,
    [
      `${payment.customerName} paid $${payment.amount} CAD with Stripe.`,
      `For: ${payment.description}`,
      "The payment was added to the job's ledger. Review it at /admin/payments",
    ].join("\n")
  );
}

const notifiedWebhookFailures = new Set<string>();

/** Tell the owner once per Stripe event when a payment event could not be recorded. */
export function alertWebhookFailure(event: { id: string; type: string }) {
  if (notifiedWebhookFailures.has(event.id)) return;
  if (notifiedWebhookFailures.size > 500) notifiedWebhookFailures.clear();
  notifiedWebhookFailures.add(event.id);
  void safeNotify(
    "A Stripe payment event could not be recorded",
    [
      `Stripe sent a "${event.type}" event (${event.id}) that the site could not process.`,
      "A customer may have paid without the payment showing in the ledger.",
      "Check the Stripe dashboard and /admin/payments, and record the payment manually if needed. Stripe will keep retrying for a few days.",
    ].join("\n")
  );
}
