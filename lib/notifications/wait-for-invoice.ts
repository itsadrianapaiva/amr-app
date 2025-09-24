"use server";
import "server-only";
import { db } from "@/lib/db";

/**
 * Hardcoded grace windows (in milliseconds).
 * Kept small to avoid webhook/function timeouts and preserve snappy UX.
 * Adjust here if you want to nudge the behavior later.
 */
export const CUSTOMER_EMAIL_INVOICE_GRACE_MS = 4000; // 4s
export const INTERNAL_EMAIL_INVOICE_GRACE_MS = 4000; // 4s

/** Internal poll cadence in milliseconds (DB-friendly, low pressure). */
const POLL_INTERVAL_MS = 400;

/** Result shape when an invoice is present. */
export type InvoiceNow = { number: string; pdfUrl: string };

/**
 * waitForInvoice
 * Polls Booking for {invoiceNumber, invoicePdfUrl} until timeout.
 * Returns the values if found; otherwise null when the timer expires.
 */
export async function waitForInvoice(
  bookingId: number,
  timeoutMs: number
): Promise<InvoiceNow | null> {
  if (!timeoutMs || timeoutMs < POLL_INTERVAL_MS) {
    // tiny optimization: skip polling if the window is effectively zero
    const b = await db.booking.findUnique({
      where: { id: bookingId },
      select: { invoiceNumber: true, invoicePdfUrl: true },
    });
    return b?.invoiceNumber && b?.invoicePdfUrl
      ? { number: b.invoiceNumber, pdfUrl: b.invoicePdfUrl }
      : null;
  }

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const b = await db.booking.findUnique({
      where: { id: bookingId },
      select: { invoiceNumber: true, invoicePdfUrl: true },
    });
    if (b?.invoiceNumber && b?.invoicePdfUrl) {
      return { number: b.invoiceNumber, pdfUrl: b.invoicePdfUrl };
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return null;
}
