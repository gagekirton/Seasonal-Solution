import { TRPCError } from "@trpc/server";
import nodemailer from "nodemailer";
import { ENV } from "./env";

export type NotificationPayload = {
  title: string;
  content: string;
};

const TITLE_MAX_LENGTH = 1200;
const CONTENT_MAX_LENGTH = 20000;

const trimValue = (value: string): string => value.trim();
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const validatePayload = (input: NotificationPayload): NotificationPayload => {
  if (!isNonEmptyString(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required.",
    });
  }
  if (!isNonEmptyString(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required.",
    });
  }

  const title = trimValue(input.title);
  const content = trimValue(input.content);

  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`,
    });
  }

  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`,
    });
  }

  return { title, content };
};

async function deliverEmail(
  to: string,
  title: string,
  content: string
): Promise<boolean> {
  if (!ENV.smtpHost) {
    console.warn(
      `[Notification] Email is not configured (set SMTP_HOST); dropping email: ${title}`
    );
    return false;
  }
  try {
    const transport = nodemailer.createTransport({
      host: ENV.smtpHost,
      port: ENV.smtpPort,
      secure: ENV.smtpPort === 465,
      auth: ENV.smtpUser
        ? { user: ENV.smtpUser, pass: ENV.smtpPass }
        : undefined,
    });
    await transport.sendMail({
      from: ENV.smtpFrom || ENV.smtpUser || "alerts@seasonalsolutions.online",
      to,
      subject: title,
      text: content,
    });
    return true;
  } catch (error) {
    console.warn("[Notification] Failed to send email:", error);
    return false;
  }
}

/**
 * Emails a notification to the site owner using the app's own SMTP settings
 * (SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM, recipient
 * ALERT_EMAIL_TO or OWNER_EMAIL). Returns `true` when the mail server accepted
 * the message. When email is not configured the alert is logged and `false` is
 * returned, so callers keep working — owner alerts are best-effort by design.
 * Validation errors bubble up as TRPC errors so callers can fix the payload.
 */
export async function notifyOwner(
  payload: NotificationPayload
): Promise<boolean> {
  const { title, content } = validatePayload(payload);

  const to = ENV.alertEmailTo || ENV.ownerEmail;
  if (!to) {
    console.warn(
      `[Notification] Email alerts are not configured (set ALERT_EMAIL_TO); dropping alert: ${title}`
    );
    return false;
  }
  return deliverEmail(to, title, content);
}

/**
 * Emails an arbitrary recipient (e.g. a customer who asked for the checklist)
 * through the same SMTP settings and best-effort rules as owner alerts.
 */
export async function sendEmail(
  to: string,
  payload: NotificationPayload
): Promise<boolean> {
  const { title, content } = validatePayload(payload);
  if (!isNonEmptyString(to)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Recipient email is required.",
    });
  }
  return deliverEmail(to.trim(), title, content);
}
