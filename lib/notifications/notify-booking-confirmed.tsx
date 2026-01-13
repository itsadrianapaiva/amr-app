"use server";
import "server-only";
import type { ReactElement } from "react";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/emails/mailer";
import { buildInvoiceLinkSnippet } from "@/lib/emails/invoice-link";

import {
  buildCustomerEmail,
  type CustomerConfirmedView,
} from "@/lib/notifications/mailers/customer-confirmed";
import {
  buildInternalEmail,
  type InternalConfirmedView,
  type NotifySource as MailerNotifySource,
} from "@/lib/notifications/mailers/internal-confirmed";

/** Call-site type stays the same for webhooks and ops. */
export type NotifySource = "customer" | "ops";

/** Admin recipients (comma-separated) for internal notifications. */
const ADMIN_TO = (
  process.env.EMAIL_ADMIN_TO ||
  process.env.ADMIN_TO ||
  "amr.business.pt@gmail.com"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/* ----------------------- Small local helpers (restored) ----------------------- */

/** Format Date → "YYYY-MM-DD" (UTC) for templates */
function toYmdUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Prisma Decimal-safe → number */
function decimalToNumber(value: unknown): number {
  if (typeof value === "number") return value;
  const anyVal = value as any;
  return anyVal && typeof anyVal.toNumber === "function"
    ? anyVal.toNumber()
    : Number(value ?? 0);
}

/** Money helpers: build strings with two decimals */
function toMoneyString(n: number): string {
  return n.toFixed(2);
}

/** Inclusive rental days: 1 + whole-day difference in UTC */
function rentalDaysInclusive(start: Date, end: Date): number {
  const ms =
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()) -
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const diff = Math.round(ms / 86_400_000);
  return Math.max(1, diff + 1);
}

/**
 * Compute VAT and totals from EX-VAT cents (source of truth).
 * Uses integer cents for precise VAT calculation at 23%.
 */
function computeTotalsFromExVatCents(netExVatCents: number) {
  const vatCents = Math.round(netExVatCents * 0.23);
  const grossCents = netExVatCents + vatCents;
  return {
    subtotalExVat: toMoneyString(netExVatCents / 100),
    vatAmount: toMoneyString(vatCents / 100),
    totalInclVat: toMoneyString(grossCents / 100),
  };
}

/** Build a human-readable add-ons string from booking flags */
function makeAddonsList(input: {
  operatorSelected: boolean;
  insuranceSelected: boolean;
  deliverySelected: boolean;
  pickupSelected: boolean;
}): string {
  const items: string[] = [];
  if (input.operatorSelected) items.push("Operator");
  if (input.insuranceSelected) items.push("Insurance");
  if (input.deliverySelected) items.push("Delivery");
  if (input.pickupSelected) items.push("Pickup");
  return items.length ? items.join(" · ") : "None";
}

/**
 * Safe Decimal-to-cents conversion (no float).
 * Converts Prisma Decimal to integer cents via string parsing.
 * Examples: Decimal("12.34") -> 1234, Decimal("12") -> 1200, Decimal("12.3") -> 1230
 */
function decimalToCents(value: unknown): number {
  if (typeof value === "number") return Math.round(value * 100);
  if (value == null) return 0;

  // Convert Decimal to string, parse as float, round to 2 decimals, then to cents
  const str = String(value);
  const num = parseFloat(str);
  if (Number.isNaN(num)) return 0;

  // Round to 2 decimal places first, then convert to cents
  return Math.round(Math.round(num * 100));
}

/** Email-friendly line item view model for itemized booking rendering */
export type EmailLineItem = {
  kind: "PRIMARY" | "SERVICE_ADDON" | "EQUIPMENT_ADDON" | "OTHER_ADDON";
  name: string;
  quantity: number;
  unitPriceCents?: number;
  lineTotalCents?: number;
  days?: number;
  chargeModel?: "PER_BOOKING" | "PER_UNIT";
  timeUnit?: "DAY" | "HOUR" | "NONE";
  addonGroup?: "SERVICE" | "EQUIPMENT" | "MATERIAL" | null;
};

/**
 * Build email line items from BookingItems.
 * Returns undefined for legacy bookings (no items).
 * Returns sorted array for cart-ready bookings.
 */
function buildEmailLineItems(params: {
  items: Array<{
    quantity: number;
    unitPrice: unknown;
    itemType: string;
    chargeModel: string;
    timeUnit: string;
    isPrimary: boolean;
    machine: {
      name: string;
      code: string;
      addonGroup: string | null;
      itemType: string;
      chargeModel: string;
      timeUnit: string;
    };
  }>;
  rentalDays: number;
}): EmailLineItem[] | undefined {
  const { items, rentalDays } = params;

  // Legacy bookings: no items
  if (!items || items.length === 0) return undefined;

  const lineItems: EmailLineItem[] = items.map((item) => {
    // Prefer BookingItem snapshot fields, fallback to Machine fields
    const itemType = item.itemType || item.machine.itemType;
    const chargeModel = item.chargeModel || item.machine.chargeModel;
    const timeUnit = item.timeUnit || item.machine.timeUnit;
    const addonGroup = item.machine.addonGroup;
    const machineCode = item.machine.code;

    // Determine kind
    let kind: EmailLineItem["kind"];
    if (item.isPrimary || itemType === "PRIMARY") {
      kind = "PRIMARY";
    } else if (addonGroup === "SERVICE") {
      kind = "SERVICE_ADDON";
    } else if (addonGroup === "EQUIPMENT") {
      kind = "EQUIPMENT_ADDON";
    } else {
      kind = "OTHER_ADDON";
    }

    // Convert unitPrice to cents safely
    const unitPriceCents = decimalToCents(item.unitPrice);

    // Compute line total based on charge model and time unit
    let lineTotalCents: number;
    let days: number | undefined;

    // PRIMARY machine pricing override (always per-day for rental duration)
    if (item.isPrimary || itemType === "PRIMARY") {
      // Primary machine rental is always priced per day: dailyRate × rentalDays
      lineTotalCents = unitPriceCents * rentalDays;
      days = rentalDays;
    }
    // SERVICE addon pricing override (matches production pricing logic)
    else if (addonGroup === "SERVICE") {
      if (machineCode === "addon-operator") {
        // Operator is priced per-day in production: €350 × rentalDays
        lineTotalCents = unitPriceCents * rentalDays;
        days = rentalDays;
      } else {
        // Insurance, delivery, pickup are flat fees in production
        lineTotalCents = unitPriceCents;
        days = undefined;
      }
    } else if (chargeModel === "PER_BOOKING") {
      lineTotalCents = unitPriceCents;
      days = undefined;
    } else if (chargeModel === "PER_UNIT") {
      if (timeUnit === "DAY") {
        lineTotalCents = unitPriceCents * item.quantity * rentalDays;
        days = rentalDays;
      } else if (timeUnit === "NONE") {
        lineTotalCents = unitPriceCents * item.quantity;
        days = undefined;
      } else if (timeUnit === "HOUR") {
        // No new hourly math: treat like NONE
        lineTotalCents = unitPriceCents * item.quantity;
        days = undefined;
      } else {
        lineTotalCents = unitPriceCents * item.quantity;
        days = undefined;
      }
    } else {
      lineTotalCents = unitPriceCents;
      days = undefined;
    }

    return {
      kind,
      name: item.machine.name,
      quantity: item.quantity,
      unitPriceCents,
      lineTotalCents,
      days,
      chargeModel: chargeModel as EmailLineItem["chargeModel"],
      timeUnit: timeUnit as EmailLineItem["timeUnit"],
      addonGroup: addonGroup as EmailLineItem["addonGroup"],
    };
  });

  // Sort: PRIMARY -> SERVICE_ADDON -> EQUIPMENT_ADDON -> OTHER_ADDON, then by name
  const kindOrder: Record<EmailLineItem["kind"], number> = {
    PRIMARY: 1,
    SERVICE_ADDON: 2,
    EQUIPMENT_ADDON: 3,
    OTHER_ADDON: 4,
  };

  lineItems.sort((a, b) => {
    const orderDiff = kindOrder[a.kind] - kindOrder[b.kind];
    if (orderDiff !== 0) return orderDiff;
    return a.name.localeCompare(b.name);
  });

  return lineItems;
}

/* ----------------------------------------------------------------------------- */

/**
 * notifyBookingConfirmed
 * Policy:
 * - Send customer confirmation once, optionally after a short wait to include invoice.
 * - If invoice exists at that time, include link and mark invoiceEmailSentAt.
 * - Send internal email once, also after a short wait to try to include invoice.
 */
export async function notifyBookingConfirmed(
  bookingId: number,
  source: NotifySource
): Promise<void> {
  // 1) Load minimal fields + items for itemized email rendering
  const b = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      machineId: true,
      startDate: true,
      endDate: true,
      customerName: true,
      customerEmail: true,
      customerPhone: true,
      customerNIF: true,
      siteAddressLine1: true,
      siteAddressCity: true,
      insuranceSelected: true,
      deliverySelected: true,
      pickupSelected: true,
      operatorSelected: true,
      totalCost: true,
      depositPaid: true,
      discountPercentage: true,
      originalSubtotalExVatCents: true,
      discountedSubtotalExVatCents: true,
      billingCompanyName: true,
      billingTaxId: true,
      billingIsBusiness: true,
      billingAddressLine1: true,
      billingPostalCode: true,
      billingCity: true,
      billingCountry: true,
      invoiceNumber: true,
      invoicePdfUrl: true,
      confirmationEmailSentAt: true,
      invoiceEmailSentAt: true,
      internalEmailSentAt: true,
      machine: { select: { name: true, deposit: true } },
      items: {
        select: {
          id: true,
          quantity: true,
          unitPrice: true,
          itemType: true,
          chargeModel: true,
          timeUnit: true,
          isPrimary: true,
          machine: {
            select: {
              id: true,
              name: true,
              code: true,
              addonGroup: true,
              itemType: true,
              chargeModel: true,
              timeUnit: true,
            },
          },
        },
      },
    },
  });
  if (!b) return;

  // 2) Derive view data once
  const startYmd = toYmdUTC(b.startDate);
  const endYmd = toYmdUTC(b.endDate);
  const machineName = b.machine?.name ?? `Machine #${b.machineId}`;
  const rentalDays = rentalDaysInclusive(b.startDate, b.endDate);

  // Determine net EX-VAT cents (source of truth for totals)
  // Prefer Stripe metadata if available, else fall back to Booking.totalCost (which is EX-VAT)
  const netExVatCents =
    b.discountedSubtotalExVatCents ?? Math.round(decimalToNumber(b.totalCost) * 100);

  const totals = computeTotalsFromExVatCents(netExVatCents);
  const depositAmount = toMoneyString(decimalToNumber(b.machine?.deposit ?? 0));
  const siteAddress = [b.siteAddressLine1 || "", b.siteAddressCity || ""]
    .filter(Boolean)
    .join(", ");
  const addonsList = makeAddonsList({
    operatorSelected: b.operatorSelected,
    insuranceSelected: b.insuranceSelected,
    deliverySelected: b.deliverySelected,
    pickupSelected: b.pickupSelected,
  });

  // Build itemized line items for cart-ready bookings (undefined for legacy)
  const lineItems = buildEmailLineItems({
    items: b.items || [],
    rentalDays,
  });

  // Calculate discount data from persisted cents values (if available)
  const discountPercentage = decimalToNumber(b.discountPercentage ?? 0);
  let discountAmountExVat: string | undefined;
  let originalSubtotalExVat: string | undefined;
  let discountedSubtotalExVat: string | undefined;

  if (
    discountPercentage > 0 &&
    b.originalSubtotalExVatCents != null &&
    b.discountedSubtotalExVatCents != null
  ) {
    // Use persisted cents values (source of truth)
    const discountCents =
      b.originalSubtotalExVatCents - b.discountedSubtotalExVatCents;
    discountAmountExVat = toMoneyString(discountCents / 100);
    originalSubtotalExVat = toMoneyString(b.originalSubtotalExVatCents / 100);
    discountedSubtotalExVat = toMoneyString(b.discountedSubtotalExVatCents / 100);
  }

  // Determine partner info (prefer billing, fallback to customer NIF)
  const partnerNif =
    (b.billingIsBusiness ? b.billingTaxId : null) || b.customerNIF || null;
  const partnerCompanyName = b.billingIsBusiness ? b.billingCompanyName : null;

  // Prepare invoice info. We may improve it with a grace wait below.
  let invoiceNow =
    b.invoiceNumber && b.invoicePdfUrl
      ? { number: b.invoiceNumber, pdfUrl: b.invoicePdfUrl }
      : null;

  const isInternalPlaceholder = (b.customerEmail || "")
    .toLowerCase()
    .endsWith("@internal.local");

  // 3) Customer confirmation — atomic claim
  let customerPromise: Promise<unknown> = Promise.resolve();
  if (source !== "ops" && b.customerEmail && !isInternalPlaceholder) {
    // A2: No longer wait for invoice (removed polling)
    // Invoice will be sent separately via notifyInvoiceReady when available

    const data: Record<string, Date> = { confirmationEmailSentAt: new Date() };
    const where: any = { id: b.id, confirmationEmailSentAt: null };
    if (invoiceNow) data.invoiceEmailSentAt = new Date();

    const claim = await db.booking.updateMany({ where, data });

    if (claim.count === 1) {
      const signedUrl = invoiceNow
        ? (await buildInvoiceLinkSnippet(b.id)).url
        : undefined;

      const customerView: CustomerConfirmedView = {
        id: b.id,
        machineName,
        startYmd,
        endYmd,
        rentalDays,
        customerName: b.customerName,
        siteAddress: siteAddress || null,
        addonsList,
        subtotalExVat: totals.subtotalExVat,
        vatAmount: totals.vatAmount,
        totalInclVat: totals.totalInclVat,
        depositAmount,
        invoicePdfUrl: signedUrl,
        deliverySelected: b.deliverySelected,
        pickupSelected: b.pickupSelected,
        discountPercentage: discountPercentage > 0 ? discountPercentage : undefined,
        discountAmountExVat,
        discountedSubtotalExVat: discountedSubtotalExVat || originalSubtotalExVat,
        partnerCompanyName: partnerCompanyName || undefined,
        partnerNif: partnerNif || undefined,
        lineItems,
      };

      // async builder (server fn)
      const react: ReactElement = await buildCustomerEmail(customerView);

      // Version breadcrumb
      console.log("[email:tmpl]", { kind: "customer", ver: "2025-10-24a" });

      customerPromise = sendEmail({
        to: b.customerEmail,
        subject: "Your AMR booking is confirmed: next steps",
        react,
        headers: { "X-Template-Ver": "booking-confirmed@2025-10-24a" },
      });
    }
  }

  // 4) Internal email — send exactly once via atomic claim
  let internalPromise: Promise<unknown> = Promise.resolve();
  {
    // A2: No longer wait for invoice (removed polling)
    // Invoice info will be included only if already available

    // Try to flip internalEmailSentAt only if it's still null.
    const internalClaim = await db.booking.updateMany({
      where: { id: b.id, internalEmailSentAt: null },
      data: { internalEmailSentAt: new Date() },
    });

    if (internalClaim.count === 1) {
      // We won the send; build and dispatch internal email.
      const internalView: InternalConfirmedView = {
        id: b.id,
        machineId: b.machineId,
        machineName,
        startYmd,
        endYmd,
        rentalDays,
        customerName: b.customerName || undefined,
        customerEmail: b.customerEmail || undefined,
        customerPhone: b.customerPhone || undefined,
        customerNIF: b.customerNIF || undefined,
        siteAddress: siteAddress || undefined,
        addonsList,
        subtotalExVat: totals.subtotalExVat,
        vatAmount: totals.vatAmount,
        totalInclVat: totals.totalInclVat,
        depositAmount,
        invoiceNumber: invoiceNow?.number || undefined,
        invoicePdfUrl: invoiceNow
          ? (await buildInvoiceLinkSnippet(b.id)).url
          : undefined,
        deliverySelected: b.deliverySelected,
        pickupSelected: b.pickupSelected,
        discountPercentage: discountPercentage > 0 ? discountPercentage : undefined,
        discountAmountExVat,
        discountedSubtotalExVat: discountedSubtotalExVat || originalSubtotalExVat,
        partnerCompanyName: partnerCompanyName || undefined,
        partnerNif: partnerNif || undefined,
        billingIsBusiness: b.billingIsBusiness,
        billingCompanyName: b.billingCompanyName || undefined,
        billingTaxId: b.billingTaxId || undefined,
        billingAddressLine1: b.billingAddressLine1 || undefined,
        billingPostalCode: b.billingPostalCode || undefined,
        billingCity: b.billingCity || undefined,
        billingCountry: b.billingCountry || undefined,
        lineItems,
      };

      const internalReact: ReactElement = await buildInternalEmail(
        internalView,
        source as MailerNotifySource
      );

      const internalSubject = `New CONFIRMED booking #${b.id}: ${machineName} · ${startYmd}–${endYmd}`;

      // Version breadcrumb
      console.log("[email:tmpl]", { kind: "internal", ver: "2025-10-24a" });

      internalPromise = sendEmail({
        to: ADMIN_TO,
        subject: internalSubject,
        react: internalReact,
        headers: { "X-Template-Ver": "booking-internal@2025-10-24a" },
      });
    }
    // else: another concurrent path already sent it; no-op.
  }

  // 5) Fire both in parallel; contain failures
  await Promise.allSettled([customerPromise, internalPromise]);
}
