// Production-ready Resend adapter with safe dry-run and Reply-To defaults.

import "server-only";
import { Resend } from "resend";
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

/**
 * sendEmail
 * - If envs are missing or SEND_EMAILS is "false", performs a dry-run:
 *   renders the body (React or text) and logs to the console instead of sending.
 * - When configured, sends via Resend with React or text body.
 * - Never throws: returns { ok:false, error } on failure so user paths don’t break.
 */

export async function sendEmail(req: MailRequest): Promise<MailResult> {
  const to = Array.isArray(req.to) ? req.to : [req.to];
  if (!req.subject || to.length === 0) {
    return { ok: false, error: 'Missing "to" or "subject".' };
  }

  const replyTo = req.replyTo ?? REPLY_TO_DEFAULT;

  if (!ENABLED) {
    // DRY-RUN mode: safe while domain or API key are not ready
    console.info("[email:dry-run]", {
      from: FROM ?? "(unset)",
      to,
      subject: req.subject,
      replyTo: req.replyTo,
      // We intentionally don't render React to HTML here to avoid Next warnings.
      bodyPreview:
        req.text ??
        (req.react ? "[React email body present]" : "(no body provided)"),
    });
    return { ok: true };
  }

  try {
    const client = getClient();
    const res = await client.emails.send({
      from: FROM!, // rely on env; already validated in ENABLED
      to,
      subject: req.subject,
      react: req.react, // Resend supports React directly
      text: req.text,
      replyTo,
      headers: req.headers,
    });

    if (res.error) return { ok: false, error: res.error.message };
    return { ok: true, id: res.data?.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email:error]", message);
    return { ok: false, error: message };
  }
}
