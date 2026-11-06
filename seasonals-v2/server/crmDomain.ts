import { randomUUID } from "node:crypto";
import { MARKETING_CONSENT_VERSION } from "../shared/crm";

export {
  MARKETING_CONSENT_COPY,
  MARKETING_CONSENT_VERSION,
} from "../shared/crm";

export function normalizeCustomerEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function createCustomerId(): string {
  return `cus_${randomUUID()}`;
}

export function createCrmId(
  prefix: "job" | "pay" | "task" | "evt" | "post" | "img" | "preq"
): string {
  return `${prefix}_${randomUUID()}`;
}

export function isLatestContact(incoming: Date, current: Date): boolean {
  return incoming.getTime() >= current.getTime();
}

export function hasCurrentMarketingConsent(customer: {
  marketingConsentAt: Date | string | null;
  marketingOptOutAt: Date | string | null;
}): boolean {
  return Boolean(customer.marketingConsentAt && !customer.marketingOptOutAt);
}

export function netCollectedValue(
  entries: Array<{ kind: "payment" | "refund"; amount: string | number }>
): number {
  const total = entries.reduce((sum, entry) => {
    const amount = Number(entry.amount);
    if (!Number.isFinite(amount) || amount < 0) return sum;
    return sum + (entry.kind === "refund" ? -amount : amount);
  }, 0);
  return Math.round((total + Number.EPSILON) * 100) / 100;
}
