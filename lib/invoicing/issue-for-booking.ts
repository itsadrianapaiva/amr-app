import "server-only";
import { vendusProvider } from "./vendus";
import { buildInvoiceInput } from "./map-stripe-to-invoice";
import type { InvoiceRecord } from "./provider";

// ---- Public, minimal API (decoupled from Prisma) ----

export type BookingFactsItem = {
  bookingItemId: number;
  machineId: number;
  name: string;
  quantity: number;
  unitPriceCents: number; // ex-VAT
  isPrimary: boolean;
};

export type BookingFacts = {
  id: number;

  // Rental window
  startDate: Date;
  endDate: Date;

  // Machine info (just what we need for the invoice line)
  machineName: string;

  // Money (ex-VAT, integer cents)
  unitDailyCents: number;

  // VAT percent for the line (23 typical in PT)
  vatPercent?: number;

  // Customer / billing (optional unless business toggle is on in your UI)
  customerName: string;
  customerEmail?: string;
  customerNIF?: string;
  billing?: {
    line1?: string;
    city?: string;
    postalCode?: string;
    country?: "PT" | string;
  };

  // Cart-ready: itemized lines (machine + equipment + service addons)
  items: BookingFactsItem[];

  // Discount metadata
  discountPercentage?: number | null;
  originalSubtotalExVatCents?: number | null;
  discountedSubtotalExVatCents?: number | null;
};

/**
 * maybeIssueInvoice
 * - Feature-flagged orchestrator: returns null when INVOICING_ENABLED !== "true".
 * - On success, returns the provider InvoiceRecord (to be persisted by the caller).
 */
export async function maybeIssueInvoice(params: {
  booking: BookingFacts;
  stripePaymentIntentId: string; // pi_...
  paidAt?: Date; // default: now
  notes?: string;
}): Promise<InvoiceRecord | null> {
  if (process.env.INVOICING_ENABLED !== "true") return null;

  const { booking, stripePaymentIntentId } = params;
  const paidAt = params.paidAt ?? new Date();
  const vatPercent = booking.vatPercent ?? 23;

  // Derive Lisbon-local YMDs and inclusive rental days
  const startYmd = lisbonYmd(booking.startDate);
  const endYmd = lisbonYmd(booking.endDate);
  const rentalDays = inclusiveDays(booking.startDate, booking.endDate);

  // Build provider-agnostic input (pure mapping layer)
  // Pass cart-ready fields (items, discount) to buildInvoiceInput
  const input = buildInvoiceInput({
    paymentIntentId: stripePaymentIntentId,
    paidAt,
    bookingId: booking.id,
    machineName: booking.machineName,
    startYmd,
    endYmd,
    rentalDays,
    unitDailyCents: booking.unitDailyCents,
    vatPercent,
    currency: "EUR",
    customer: {
      name: booking.customerName,
      email: booking.customerEmail,
      nif: booking.customerNIF,
      address: booking.billing
        ? {
            line1: booking.billing.line1 ?? "",
            city: booking.billing.city ?? "",
            postalCode: booking.billing.postalCode ?? "",
            country: (booking.billing.country as "PT") || "PT",
          }
        : undefined,
    },
    notes: params.notes,
    // Cart-ready fields
    items: booking.items,
    discountPercentage: booking.discountPercentage,
    originalSubtotalExVatCents: booking.originalSubtotalExVatCents,
    discountedSubtotalExVatCents: booking.discountedSubtotalExVatCents,
  } as any);

  // Delegate to the provider (Vendus) — still decoupled via interface
  const record = await vendusProvider.createInvoice(input);
  return record;
}

// ---- Local helpers (kept tiny and testable) ----

// Format a JS Date as YYYY-MM-DD in Europe/Lisbon without pulling extra deps.
function lisbonYmd(d: Date): string {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt
    .formatToParts(d)
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

// Parse YYYY-MM-DD into a UTC midnight Date (no DST effects).
function ymdToUtcDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

// Inclusive day count based on Lisbon-local YMDs mapped to UTC midnight.
// This avoids DST offsets by never constructing +01:00 or +00:00 timestamps from the original Date.
function inclusiveDays(start: Date, end: Date): number {
  const sYmd = lisbonYmd(start);
  const eYmd = lisbonYmd(end);
  const sUtc = ymdToUtcDate(sYmd);
  const eUtc = ymdToUtcDate(eYmd);
  const days = Math.round((eUtc.getTime() - sUtc.getTime()) / 86_400_000) + 1;
  return Math.max(1, days);
}
