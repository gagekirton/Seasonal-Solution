// Platform values are read at use time from the app's own environment.
// See .env.example for the full list. (Replaced the Manus platform variables
// in the 2026-11-11 rebuild.)
export const ENV = {
  get appId() { return process.env.APP_ID ?? "seasonal-solutions"; },
  get cookieSecret() { return process.env.JWT_SECRET ?? ""; },
  get databaseUrl() { return process.env.DATABASE_URL ?? ""; },
  // Preserve the legacy hint when supplied; otherwise roles remain application data.
  get ownerOpenId() { return process.env.OWNER_OPEN_ID ?? ""; },
  // First-run owner bootstrap: when no account exists for this email yet, a
  // sign-in with OWNER_EMAIL + OWNER_PASSWORD creates the owner account.
  get ownerEmail() { return process.env.OWNER_EMAIL ?? ""; },
  get ownerPassword() { return process.env.OWNER_PASSWORD ?? ""; },
  // Second approved dashboard sign-in (for example a helper doing maintenance
  // and assistance): when no account exists for this email yet, a sign-in
  // with ADMIN_EMAIL + ADMIN_PASSWORD creates an admin account for it.
  get adminEmail() { return process.env.ADMIN_EMAIL ?? ""; },
  get adminPassword() { return process.env.ADMIN_PASSWORD ?? ""; },
  get isProduction() { return process.env.NODE_ENV === "production"; },
  // Local directory that holds uploaded files (see server/storage.ts).
  get storageDir() { return process.env.STORAGE_DIR ?? "data/uploads"; },
  // Owner email alerts (see server/_core/notification.ts).
  get alertEmailTo() { return process.env.ALERT_EMAIL_TO ?? ""; },
  get smtpHost() { return process.env.SMTP_HOST ?? ""; },
  get smtpPort() { return Number(process.env.SMTP_PORT ?? "587"); },
  get smtpUser() { return process.env.SMTP_USER ?? ""; },
  get smtpPass() { return process.env.SMTP_PASS ?? ""; },
  get smtpFrom() { return process.env.SMTP_FROM ?? ""; },
};
