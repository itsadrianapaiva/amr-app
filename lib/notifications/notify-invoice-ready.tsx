"use server";
import "server-only";
import type { ReactElement } from "react";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/emails/mailer";
import { buildInvoiceLinkSnippet } from "@/lib/emails/invoice-link";

/** Simple, local email body for the "invoice ready" email to keep this change scoped to one file. */
function InvoiceReadyEmail(props: {
  companyName: string;
  customerName?: string;
  bookingId: number;
  invoiceNumber?: string;
  invoiceUrl: string;
  supportEmail: string;
  supportPhone: string;
}): ReactElement {
  const greeting = props.customerName ? `Hi ${props.customerName},` : "Hello,";
  return (
    <div>
      <p>{greeting}</p>
      <p>
        Your invoice for booking #{props.bookingId}
        {props.invoiceNumber ? ` (${props.invoiceNumber})` : ""} is ready.
      </p>
      <p>
        Download your invoice PDF here:{" "}
        <a href={props.invoiceUrl}>{props.invoiceUrl}</a>
      </p>
      <hr />
      <p>
        {props.companyName} • Questions? {props.supportEmail} ·{" "}
        {props.supportPhone}
      </p>
    </div>
  );
}

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

  // 6) Compose email
  const react: ReactElement = (
    <InvoiceReadyEmail
      companyName={process.env.COMPANY_NAME || "Algarve Machinery Rental"}
      customerName={b.customerName || undefined}
      bookingId={b.id}
      invoiceNumber={b.invoiceNumber || undefined}
      invoiceUrl={link.url}
      supportEmail={
        process.env.EMAIL_REPLY_TO ||
        process.env.SUPPORT_EMAIL ||
        "support@amr-rentals.com"
      }
      supportPhone={process.env.SUPPORT_PHONE || "351934014611"}
    />
  );

  // 7) Send
  await sendEmail({
    to: email,
    subject: `Your AMR invoice for booking #${b.id}`,
    react,
  });
}
