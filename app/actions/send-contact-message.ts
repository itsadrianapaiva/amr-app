"use server";

import { CONTACTS } from "@/lib/content/contacts";
import {
  toFormPayload,
  validateContactPayload,
  type ContactFormPayload,
} from "@/lib/contacts/utils";
import { sendEmail } from "@/lib/emails/mailer";

/** Result returned to the client form. Keep it tiny and serializable. */
export type ContactActionResult =
  | { ok: true }
  | { ok: false; formError: string };

/**
 * sendContactMessage
 * Server Action to validate a contact form submission and email Support.
 * - Validates with our shared pure helpers (no duplication).
 * - Uses Resend adapter through lib/emails/mailer (dry-run friendly).
 */
export async function sendContactMessage(
  formData: FormData
): Promise<ContactActionResult> {
  // 1) Extract & validate
  const payload: ContactFormPayload = toFormPayload(formData);
  const errors = validateContactPayload(payload);
  if (errors.length > 0) {
    return { ok: false, formError: errors.join(" ") };
  }

  // 2) Compose a minimal PLAIN-TEXT email (adapter-friendly)
  const subject = `New contact message — ${payload.name}`;
  const text = buildPlainText(payload);

  // 3) Destination: prefer explicit admin inbox; fall back to CONTACTS.support.email
  const to =
    (process.env.EMAIL_ADMIN_TO?.trim() ?? "") ||
    (CONTACTS.support.email ?? "");

  if (!to) {
    // Fail fast with a clear configuration error
    return {
      ok: false,
      formError:
        "Support email isn't configured. Please set EMAIL_ADMIN_TO or CONTACTS.support.email.",
    };
  }

  // 4) Send via mailer adapter (dry-run safe per our adapter’s env)
  try {
    await sendEmail({
      to,
      subject,
      text, // <-- use 'text' because MailRequest doesn't accept 'html'
      // Let support reply directly to the customer
      replyTo: payload.email,
    });

    return { ok: true };
  } catch (err) {
    console.error("sendContactMessage: mailer error", err);
    return {
      ok: false,
      formError:
        "We couldn't send your message right now. Please try WhatsApp or email us directly.",
    };
  }
}

/** Small helper to keep the body formatting tidy and testable. */
function buildPlainText(p: ContactFormPayload): string {
  return [
    "New contact enquiry",
    "",
    `Name:   ${p.name}`,
    `Email:  ${p.email}`,
    "",
    "Message:",
    p.message,
    "",
    `Sent from AMR website • ${new Date().toISOString()}`,
  ].join("\n");
}
