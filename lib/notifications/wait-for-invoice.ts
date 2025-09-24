"use server";
import "server-only";
import { db } from "@/lib/db";

/**
 * Hardcoded grace windows (ms). KEPT PRIVATE in this module to comply with
 * `"use server"` rule: only export async functions.
 */
const CUSTOMER_EMAIL_INVOICE_GRACE_MS = 4000; // 4s
const INTERNAL_EMAIL_INVOICE_GRACE_MS = 4000; // 4s;

/** Internal poll cadence (ms) — private. */
const POLL_INTERVAL_MS = 400;

/** Result shape when an invoice is present. */
export type InvoiceNow = { number: string; pdfUrl: string };

/**
 * getCustomerInvoiceGraceMs
 * Async getter to satisfy the "export async only" constraint on this file.
 */
export async function getCustomerInvoiceGraceMs(): Promise<number> {
  return CUSTOMER_EMAIL_INVOICE_GRACE_MS;
}

/**
 * getInternalInvoiceGraceMs
 * Async getter to satisfy the "export async only" constraint on this file.
 */
export async function getInternalInvoiceGraceMs(): Promise<number> {
  return INTERNAL_EMAIL_INVOICE_GRACE_MS;
}

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
    // tiny optimization: single read if window is effectively zero
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
