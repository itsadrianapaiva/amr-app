"use server";
import "server-only";
import type { ReactElement } from "react";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/emails/mailer";
import { buildInvoiceLinkSnippet } from "@/lib/emails/invoice-link";
import InvoiceReadyEmail, {
  subjectForInvoiceReady,
} from "@/lib/emails/templates/invoice-ready";

/**
 * Send the "invoice ready" email exactly once per booking.
 * Preconditions:
 *  - booking exists
 *  - invoiceNumber and invoicePdfUrl are present
 *  - customerEmail is real (not an internal placeholder)
 * Idempotency:
 *  - updateMany(...) claim on invoiceEmailSentAt ensures a single send even under retries.
 */
export async function notifyInvoiceReady(bookingId: number): Promise<void> {
  // 1) Load minimal fields required for this email (keep select lean)
  const b = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      customerName: true,
      customerEmail: true,
      invoiceNumber: true,
      invoicePdfUrl: true,
      invoiceEmailSentAt: true,
    },
  });
  if (!b) return;

  // 2) Preconditions: invoice must be persisted
  const hasInvoice = !!b.invoiceNumber && !!b.invoicePdfUrl;
  if (!hasInvoice) return;

  // 3) Skip internal placeholders or missing email
  const email = b.customerEmail || "";
  if (!email || email.toLowerCase().endsWith("@internal.local")) return;

  // 4) Atomic claim: send this email exactly once
  const claim = await db.booking.updateMany({
    where: { id: b.id, invoiceEmailSentAt: null },
    data: { invoiceEmailSentAt: new Date() },
  });
  if (claim.count !== 1) return; // someone else already sent it

  // 5) Build signed proxy URL via centralized resolver (prevents $deploy_prime_url leaks)
  const link = buildInvoiceLinkSnippet(b.id);

  // 6) Compose email with shared template (keeps brand styling in one place)
  const react: ReactElement = (
    <InvoiceReadyEmail
      companyName={process.env.COMPANY_NAME || "Algarve Machinery Rental"}
      supportEmail={
        process.env.EMAIL_REPLY_TO ||
        process.env.SUPPORT_EMAIL ||
        "support@amr-rentals.com"
      }
      supportPhone={process.env.SUPPORT_PHONE || "351934014611"}
      customerName={b.customerName || undefined}
      bookingId={b.id}
      invoiceNumber={b.invoiceNumber || undefined}
      invoiceUrl={link.url}
    />
  );

  // 7) Send with centralized subject helper
  await sendEmail({
    to: email,
    subject: subjectForInvoiceReady(b.id, b.invoiceNumber || undefined),
    react,
  });
}
