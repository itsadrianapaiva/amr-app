// needs update after getting a registered domain

import "server-only";
import { Resend } from "resend";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

type MailRequest = {
  to: string | string[];
  subject: string;
  react?: ReactElement; // Optional React email body
  text?: string; // Optional plain-text fallback
  replyTo?: string; // We'll set your Gmail here for now
  headers?: Record<string, string>;
};

type MailResult = { ok: true; id?: string } | { ok: false; error: string };

// Read configuration once at module load
const FROM = process.env.EMAIL_FROM; // e.g. "AMR <noreply@amr.pt>"
const API_KEY = process.env.RESEND_API_KEY; // Your Resend API key
const ENABLED = !!API_KEY && !!FROM && process.env.SEND_EMAILS !== "false";

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

  if (!ENABLED) {
    // DRY-RUN mode: safe while we don’t have a domain or API key
    const preview =
      req.text ?? (req.react ? renderToStaticMarkup(req.react) : "(no body)");
    console.info("[email:dry-run]", {
      from: FROM ?? "(unset)",
      to,
      subject: req.subject,
      replyTo: req.replyTo,
      preview: preview.slice(0, 1000), // keep logs readable
    });
    return { ok: true };
  }

  try {
    const res = await getClient().emails.send({
      from: FROM!,
      to,
      subject: req.subject,
      react: req.react,
      text: req.text,
      replyTo: req.replyTo,
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
