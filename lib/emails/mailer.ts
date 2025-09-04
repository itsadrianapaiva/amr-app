// lib/emails/mailer.ts
// Production-ready Resend adapter with safe dry-run and Reply-To defaults.

import "server-only";
import { Resend } from "resend";
import { renderAsync } from "@react-email/render"; // render React → HTML
import type { ReactElement } from "react";

type MailRequest = {
  to: string | string[];
  subject: string;
  react?: ReactElement; // Optional React email body
  text?: string; // Optional plain-text fallback
  replyTo?: string; // We'll set your Gmail here for now
  headers?: Record<string, string>;
};

type MailResult = { ok: true; id?: string } | { ok: false; error: string };

// --- Configuration (read once at module load)
const FROM = process.env.EMAIL_FROM; // e.g., "noreply@amr-rentals.com" or "AMR <noreply@…>"
const REPLY_TO_DEFAULT = process.env.EMAIL_REPLY_TO; // e.g., "support@amr-rentals.com"
const API_KEY = process.env.RESEND_API_KEY; // Resend key (Sending access is sufficient)
const SEND_FLAG = process.env.SEND_EMAILS === "true"; // Only send when explicitly "true"
const ENABLED = !!API_KEY && !!FROM && SEND_FLAG;

// Singleton Resend client to avoid re-creating per call
let resend: Resend | null = null;
function getClient(): Resend {
  if (!resend) resend = new Resend(API_KEY!);
  return resend;
}

/** Public helper to check if real sending is active (useful for logs/health). */
export function emailsEnabled() {
  return ENABLED;
}

/** A minimal shape accepted by `resend.emails.send` when sending pre-rendered HTML. */
type HtmlSendOptions = {
  from: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  headers?: Record<string, string>;
};

/**
 * sendEmail
 * - If envs are missing or SEND_EMAILS is "false", performs a dry-run:
 *   renders the body (React or text) and logs to the console instead of sending.
 * - When configured, renders React to HTML with @react-email/render and sends via Resend.
 * - Never throws: returns { ok:false, error } on failure so user paths don’t break.
 */
export async function sendEmail(req: MailRequest): Promise<MailResult> {
  const to = Array.isArray(req.to) ? req.to : [req.to];
  if (!req.subject || to.length === 0) {
    return { ok: false, error: 'Missing "to" or "subject".' };
  }

  const replyTo = req.replyTo ?? REPLY_TO_DEFAULT;

  // Resolve HTML if we have a React template. Keep text as optional fallback.
  let html: string | undefined;
  if (req.react) {
    try {
      html = await renderAsync(req.react);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[email:error] render failed", msg);
      return { ok: false, error: "Email render failed" };
    }
  }

  if (!ENABLED) {
    // DRY-RUN mode: safe while domain or API key are not ready
    console.info("[email:dry-run]", {
      from: FROM ?? "(unset)",
      to,
      subject: req.subject,
      replyTo,
      bodyPreview:
        req.text ??
        (html
          ? `[HTML ${Buffer.byteLength(html, "utf8")} bytes]`
          : req.react
          ? "[React email body present]"
          : "(no body provided)"),
    });
    return { ok: true };
  }

  try {
    const client = getClient();

    // Require at least one of html or text for the live send
    if (!html && !req.text) {
      return { ok: false, error: "No email content provided (html or text required)." };
    }

    // Narrow, HTML-centric send options to steer TS to the right overload.
    const options: HtmlSendOptions = {
      from: FROM!, // validated via ENABLED
      to,
      subject: req.subject,
      html,
      text: req.text,
      replyTo,
      headers: req.headers,
    };

    // NOTE: Older `resend` typings may still prefer the "react" overload.
    // Casting the options to the minimal shape avoids TS2345 while keeping runtime safe.
    const res = await client.emails.send(options as any);

    if (res.error) return { ok: false, error: res.error.message };
    console.log("[email] sent", { to, subject: req.subject, id: res.data?.id });
    return { ok: true, id: res.data?.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email:error]", message);
    return { ok: false, error: message };
  }
}
