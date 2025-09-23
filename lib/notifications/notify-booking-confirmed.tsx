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
 * Split a VAT-inclusive total into ex-VAT + VAT at 23%.
 * Assumes totalIncl = ex * 1.23 → ex = total / 1.23
 */
function splitVatFromTotal(totalIncl: number) {
  const ex = totalIncl / 1.23;
  const vat = totalIncl - ex;
  return {
    subtotalExVat: toMoneyString(ex),
    vatAmount: toMoneyString(vat),
    totalInclVat: toMoneyString(totalIncl),
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

/* ----------------------------------------------------------------------------- */

/**
 * notifyBookingConfirmed
 * Policy:
 * - Send confirmation exactly once.
 * - If invoice exists at that time, include link AND mark invoiceEmailSentAt,
 *   so later notify-invoice-ready will no-op (max two emails for customer).
 * - Always send internal email.
 */
export async function notifyBookingConfirmed(
  bookingId: number,
  source: NotifySource
): Promise<void> {
  // 1) Load minimal fields
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
      siteAddressLine1: true,
      siteAddressCity: true,
      insuranceSelected: true,
      deliverySelected: true,
      pickupSelected: true,
      operatorSelected: true,
      totalCost: true,
      depositPaid: true,
      invoiceNumber: true,
      invoicePdfUrl: true,
      confirmationEmailSentAt: true,
      invoiceEmailSentAt: true,
      machine: { select: { name: true, deposit: true } },
    },
  });
  if (!b) return;

  // 2) Derive view data once
  const startYmd = toYmdUTC(b.startDate);
  const endYmd = toYmdUTC(b.endDate);
  const machineName = b.machine?.name ?? `Machine #${b.machineId}`;
  const rentalDays = rentalDaysInclusive(b.startDate, b.endDate);
  const totals = splitVatFromTotal(decimalToNumber(b.totalCost));
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
  const hasInvoiceNow = !!b.invoiceNumber && !!b.invoicePdfUrl;
  const signed = hasInvoiceNow ? buildInvoiceLinkSnippet(b.id) : undefined;

  const isInternalPlaceholder = (b.customerEmail || "")
    .toLowerCase()
    .endsWith("@internal.local");

  // 3) Customer confirmation — atomic claim
  let customerPromise: Promise<unknown> = Promise.resolve();
  if (source !== "ops" && b.customerEmail && !isInternalPlaceholder) {
    const data: Record<string, Date> = { confirmationEmailSentAt: new Date() };
    const where: any = { id: b.id, confirmationEmailSentAt: null };
    if (hasInvoiceNow) data.invoiceEmailSentAt = new Date();

    const claim = await db.booking.updateMany({ where, data });

    if (claim.count === 1) {
      const customerView: CustomerConfirmedView = {
        id: b.id,
        machineName,
        startYmd,
        endYmd,
        rentalDays,
        customerName: b.customerName,
        siteAddress: siteAddress || null,
        subtotalExVat: totals.subtotalExVat,
        vatAmount: totals.vatAmount,
        totalInclVat: totals.totalInclVat,
        depositAmount,
        invoicePdfUrl: signed?.url,
      };

      // async builder (server fn)
      const react: ReactElement = await buildCustomerEmail(customerView);

      customerPromise = sendEmail({
        to: b.customerEmail,
        subject: "Your AMR booking is confirmed: next steps",
        react,
      });
    }
  }

  // 4) Internal email — always
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
    siteAddress: siteAddress || undefined,
    addonsList,
    subtotalExVat: totals.subtotalExVat,
    vatAmount: totals.vatAmount,
    totalInclVat: totals.totalInclVat,
    depositAmount,
    invoiceNumber: b.invoiceNumber || undefined,
    invoicePdfUrl: signed?.url,
  };

  const internalReact: ReactElement = await buildInternalEmail(
    internalView,
    source as MailerNotifySource
  );

  const internalSubject = `New CONFIRMED booking #${b.id}: ${machineName} · ${startYmd}–${endYmd}`;

  const internalPromise = sendEmail({
    to: ADMIN_TO,
    subject: internalSubject,
    react: internalReact,
  });

  // 5) Fire both in parallel; contain failures
  await Promise.allSettled([customerPromise, internalPromise]);
}
