/** Conservative guard, not a substitute for customer warnings or PCI controls. */
export function containsPaymentCredentials(value: unknown): boolean {
  if (typeof value === "string") {
    const candidates = value.match(/(?<!\d)\d(?:[ -]?\d){12,18}(?!\d)/g) ?? [];
    for (const candidate of candidates) {
      const digits = candidate.replace(/\D/g, "");
      if (/^(\d)\1+$/.test(digits)) continue;
      let sum = 0;
      let double = false;
      for (let i = digits.length - 1; i >= 0; i--) {
        let digit = Number(digits[i]);
        if (double) {
          digit *= 2;
          if (digit > 9) digit -= 9;
        }
        sum += digit;
        double = !double;
      }
      if (sum % 10 === 0) return true;
    }
    return /\b(?:bank\s+account|account\s+number|routing\s+number|iban)\s*(?:[:=#-]|is)?\s*[A-Z]{0,2}\d(?:[ -]?\d){4,33}\b/i.test(
      value
    );
  }
  if (Array.isArray(value)) return value.some(containsPaymentCredentials);
  if (value && typeof value === "object")
    return Object.entries(value).some(
      ([key, field]) =>
        ![
          "id",
          "customerId",
          "jobId",
          "leadId",
          "scheduledAt",
          "dueAt",
        ].includes(key) && containsPaymentCredentials(field)
    );
  return false;
}
