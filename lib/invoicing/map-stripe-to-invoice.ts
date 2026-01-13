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
 * - Supports itemized lines from BookingFacts.items (cart-ready).
 * - Applies discounts via proportional allocation across lines.
 * - Keeps vendor logic out; vendus.ts will translate this DTO to Vendus fields.
 */
export function buildInvoiceInput(p: BuildInvoiceParams): InvoiceCreateInput {
  const currency = p.currency ?? "EUR";
  const anyP = p as any;

  // Build invoice lines from BookingFacts.items if available (cart-ready)
  const items: typeof anyP.items = anyP.items || [];
  let lines: InvoiceLine[] = [];

  if (items.length > 0) {
    // Cart-ready: build lines from itemized BookingItems + service addons
    lines = items.map((item: any) => {
      const lineTotalCents = item.unitPriceCents * item.quantity;
      const isPrimary = item.isPrimary;

      // For primary machine, include rental period in description
      let description = item.name;
      if (isPrimary && p.rentalDays) {
        description = `${item.name} — ${p.rentalDays} day${p.rentalDays === 1 ? "" : "s"} (${p.startYmd} to ${p.endYmd})`;
      }

      return {
        description,
        quantity: 1, // Collapse to quantity=1 with total cents for discount allocation safety
        unitPriceCents: lineTotalCents,
        vatPercent: p.vatPercent,
        itemRef: `item:${item.bookingItemId}:machine:${item.machineId}`,
      };
    });
  } else {
    // Legacy fallback: single-line invoice (backward compatibility)
    const description =
      `${p.machineName} — ${p.rentalDays} day${p.rentalDays === 1 ? "" : "s"} ` +
      `(${p.startYmd} to ${p.endYmd})`;

    lines = [
      {
        description,
        quantity: 1,
        unitPriceCents: p.unitDailyCents * p.rentalDays,
        vatPercent: p.vatPercent,
        itemRef: `machine:${p.machineName}`,
      },
    ];
  }

  // Apply discount if present (cent-exact, proportional allocation)
  const discountedSubtotalCents = anyP.discountedSubtotalExVatCents;
  const originalSubtotalCents = anyP.originalSubtotalExVatCents;

  if (
    discountedSubtotalCents != null &&
    discountedSubtotalCents > 0 &&
    originalSubtotalCents != null &&
    originalSubtotalCents > discountedSubtotalCents
  ) {
    const discountCents = originalSubtotalCents - discountedSubtotalCents;
    const originalSum = lines.reduce(
      (sum, line) => sum + line.unitPriceCents * line.quantity,
      0
    );

    // Allocate discount proportionally
    let allocatedDiscount = 0;
    const allocations = lines.map((line) => {
      const lineTotal = line.unitPriceCents * line.quantity;
      const allocation = Math.floor((discountCents * lineTotal) / originalSum);
      allocatedDiscount += allocation;
      return allocation;
    });

    // Distribute residue to largest line
    const residue = discountCents - allocatedDiscount;
    if (residue > 0) {
      const largestIdx = lines.reduce(
        (maxIdx, line, idx) =>
          line.unitPriceCents > lines[maxIdx].unitPriceCents ? idx : maxIdx,
        0
      );
      allocations[largestIdx] += residue;
    }

    // Apply allocations (reduce unitPriceCents by allocation since quantity=1)
    lines = lines.map((line, idx) => ({
      ...line,
      unitPriceCents: Math.max(0, line.unitPriceCents - allocations[idx]),
    }));
  }

  // Guardrail: compute invoice total and require Stripe metadata for validation
  const invoiceNetCents = lines.reduce(
    (sum, line) => sum + line.unitPriceCents * line.quantity,
    0
  );
  const expectedNetCents = discountedSubtotalCents ?? originalSubtotalCents;

  if (expectedNetCents == null || expectedNetCents === 0) {
    const errorDetails = JSON.stringify({
      bookingId: p.bookingId,
      invoiceNetCents,
      discountedSubtotalCents,
      originalSubtotalCents,
    });
    console.error(
      `[invoice:missing_metadata] Cannot validate invoice total: ${errorDetails}`
    );
    throw new Error(
      `Cannot validate invoice total for booking ${p.bookingId}: missing Stripe metadata (discountedSubtotalExVatCents/originalSubtotalExVatCents)`
    );
  }

  if (Math.abs(invoiceNetCents - expectedNetCents) > 1) {
    const errorDetails = JSON.stringify({
      bookingId: p.bookingId,
      expectedNetCents,
      invoiceNetCents,
      diff: invoiceNetCents - expectedNetCents,
      lineCount: lines.length,
      discountedSubtotalCents,
      originalSubtotalCents,
    });
    console.error(
      `[invoice:mismatch] Invoice total mismatch: ${errorDetails}`
    );
    throw new Error(
      `Invoice total mismatch: expected ${expectedNetCents} cents, got ${invoiceNetCents} cents (diff: ${invoiceNetCents - expectedNetCents}). Booking ${p.bookingId}.`
    );
  }

  return {
    idempotencyKey: `booking:${p.bookingId}:pi:${p.paymentIntentId}`,
    externalRef: p.paymentIntentId,
    issuedAt: p.paidAt,
    currency,
    customer: p.customer,
    lines,
    notes: p.notes,
  };
}
