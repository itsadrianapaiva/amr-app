import "server-only";
import type {
  InvoiceCreateInput,
  InvoiceLine,
  Customer,
} from "./provider";

// ---- Inputs kept tiny & explicit (no coupling to your models) ----
export type BuildInvoiceParams = {
  // Stripe facts
  paymentIntentId: string; // pi_...
  paidAt: Date;            // when Stripe reports success

  // Booking facts
  bookingId: number;
  machineName: string;
  startYmd: string;  // "2025-09-30"
  endYmd: string;    // "2025-10-01"
  rentalDays: number;

  // Money (integer cents)
  unitDailyCents: number;  // ex: 150_00 for €150.00/day (gross UI total known separately)
  vatPercent: number;      // PT standard 23
  currency?: "EUR";

  // Customer (billing)
  customer: Customer; // name, email?, nif?, address?
  // Optional notes for the invoice footer
  notes?: string;
};

/**
 * buildInvoiceInput
 * - Produces a provider-agnostic InvoiceCreateInput using integer-cents math.
 * - Keeps vendor logic out; vendus.ts will translate this DTO to Vendus fields.
 */
export function buildInvoiceInput(p: BuildInvoiceParams): InvoiceCreateInput {
  const currency = p.currency ?? "EUR";

  const description =
    `${p.machineName} — ${p.rentalDays} day${p.rentalDays === 1 ? "" : "s"} ` +
    `(${p.startYmd} to ${p.endYmd})`;

  const line: InvoiceLine = {
    description,
    quantity: p.rentalDays,
    unitPriceCents: p.unitDailyCents,
    vatPercent: p.vatPercent, // vendus.ts will map 23 -> "NOR"
    itemRef: `machine:${p.machineName}`,
  };

  return {
    idempotencyKey: `booking:${p.bookingId}:pi:${p.paymentIntentId}`,
    externalRef: p.paymentIntentId,
    issuedAt: p.paidAt, // vendus.ts will format yyyy-mm-dd Lisbon
    currency,
    customer: p.customer,
    lines: [line],
    notes: p.notes,
  };
}
