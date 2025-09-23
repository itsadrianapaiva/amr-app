// lib/notifications/notify-invoice-ready.tsx
"use server";
import "server-only";
import type { ReactElement } from "react";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/emails/mailer";
import { buildInvoiceLinkSnippet } from "@/lib/emails/invoice-link";
import InvoiceReadyEmail, {
  subjectForInvoiceReady as subjectForInvoiceReadyRaw,
} from "@/lib/emails/templates/invoice-ready";

/**
 * Sends the “invoice ready” email exactly once (idempotent).
 * Returns true if an email was sent on this call; false if it no-oped.
 * Errors bubble to caller so webhook can log.
 */
export async function notifyInvoiceReady(bookingId: number): Promise<boolean> {
  // 1) Fetch minimal fields (lean over RSC boundary).
  const booking = await db.booking.findUnique({
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

  // 2) Guards:
  // - Booking must exist
  // - Must have an invoice number (provider details are implicit; PDF resolves via proxy)
  if (!booking || !booking.invoiceNumber) return false;

  // Optional: skip internal/placeholder addresses (keeps test "internal.local" green)
  if (booking.customerEmail?.endsWith("@internal.local")) return false;

  // 3) Idempotency claim: only first caller flips timestamp; others no-op.
  const claim = await db.booking.updateMany({
    where: { id: bookingId, invoiceEmailSentAt: null },
    data: { invoiceEmailSentAt: new Date() },
  });
  if (claim.count === 0) return false;

  // 4) Build signed invoice link (public-safe proxy URL).
  const { url: invoiceUrl } = buildInvoiceLinkSnippet(bookingId);

  // 5) Subject + React email
  const subjectForInvoiceReady = subjectForInvoiceReadyRaw as unknown as (
    bookingId: number,
    invoiceNumber?: string
  ) => string;
  const subject = subjectForInvoiceReady(booking.id, booking.invoiceNumber);

  const react: ReactElement = (
    <InvoiceReadyEmail
      companyName={process.env.COMPANY_NAME || "Algarve Machinery Rentals"}
      supportEmail={process.env.SUPPORT_EMAIL || "support@algarvemachinery.pt"}
      supportPhone={process.env.SUPPORT_PHONE || "+351 000 000 000"}
      customerName={booking.customerName}
      bookingId={booking.id}
      invoiceNumber={booking.invoiceNumber}
      invoiceUrl={invoiceUrl}
    />
  );

  // 6) Send (let errors bubble up).
  await sendEmail({
    to: booking.customerEmail,
    subject,
    react,
  });

  return true;
}
