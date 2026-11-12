/**
 * HANDOFF: Best-effort owner notifications by email (failures are swallowed).
 * Messages include customer names and contact details: keep them minimal and never include card data.
 */
import {
  BUSINESS,
  CHECKLIST,
  CHECKLIST_TITLE,
  SERVICES,
  SITE_ORIGIN,
} from "../shared/site";
import { notifyOwner, sendEmail } from "./_core/notification";

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

export function alertChecklistSignup(signup: { name: string; email: string }) {
  void safeNotify(`New checklist signup — ${signup.name}`, [
    "Lead magnet: The Winnipeg Seasonal Home Checklist",
    `Name: ${signup.name}`,
    `Email: ${signup.email}`,
    "",
    "They are saved in the lead inbox as a seasonal maintenance lead.",
    "Open the dashboard: /admin/leads",
  ].join("\n"));
}

function checklistEmailText(name: string): string {
  const seasons = CHECKLIST.map(block =>
    [
      `${block.season.toUpperCase()} — ${block.timing}`,
      ...block.items.map((item, index) => `${index + 1}. ${item.title} — ${item.detail}`),
    ].join("\n")
  ).join("\n\n");
  return [
    `Hi ${name},`,
    "",
    `Here is your copy of ${CHECKLIST_TITLE} — forty jobs, four seasons, written for Winnipeg homes.`,
    `You can also read and print it any time: ${SITE_ORIGIN}/checklist`,
    "",
    seasons,
    "",
    "Rather hand the list over? Seasonal Solutions' seasonal maintenance service works through exactly this list — request a quote at " +
      `${SITE_ORIGIN}/contact or call ${BUSINESS.phoneDisplay}.`,
    "",
    "You asked to receive this checklist and a short reminder when each season turns. Reply to this email to unsubscribe.",
    "",
    "— Seasonal Solutions, Winnipeg",
  ].join("\n");
}

/** Emails the subscriber their checklist copy; best-effort, never throws. */
export function emailChecklistCopy(signup: { name: string; email: string }) {
  void (async () => {
    try {
      await sendEmail(signup.email, {
        title: `Your copy: ${CHECKLIST_TITLE}`,
        content: checklistEmailText(signup.name),
      });
    } catch (error) {
      console.warn(
        "[Alerts] Checklist copy email failed:",
        error instanceof Error ? error.message : "unknown error"
      );
    }
  })();
}
