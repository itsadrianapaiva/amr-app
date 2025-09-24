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

import {
  waitForInvoice,
  getCustomerInvoiceGraceMs,
  getInternalInvoiceGraceMs,
} from "@/lib/notifications/wait-for-invoice";

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
 * - Send customer confirmation once, optionally after a short wait to include invoice.
 * - If invoice exists at that time, include link and mark invoiceEmailSentAt.
 * - Send internal email once, also after a short wait to try to include invoice.
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
      internalEmailSentAt: true,
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
    // use async getter (complies with "use server" export rule)
    const customerGraceMs = await getCustomerInvoiceGraceMs();
    if (!invoiceNow) {
      const waited = await waitForInvoice(b.id, customerGraceMs);
      if (waited) invoiceNow = waited;
    }

    const data: Record<string, Date> = { confirmationEmailSentAt: new Date() };
    const where: any = { id: b.id, confirmationEmailSentAt: null };
    if (invoiceNow) data.invoiceEmailSentAt = new Date();

    const claim = await db.booking.updateMany({ where, data });

    if (claim.count === 1) {
      const signedUrl = invoiceNow
        ? buildInvoiceLinkSnippet(b.id).url
        : undefined;

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
        invoicePdfUrl: signedUrl,
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

  // 4) Internal email — send exactly once via atomic claim
  let internalPromise: Promise<unknown> = Promise.resolve();
  {
    const internalGraceMs = await getInternalInvoiceGraceMs();
    if (!invoiceNow) {
      const waited = await waitForInvoice(b.id, internalGraceMs);
      if (waited) invoiceNow = waited;
    }

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
        siteAddress: siteAddress || undefined,
        addonsList,
        subtotalExVat: totals.subtotalExVat,
        vatAmount: totals.vatAmount,
        totalInclVat: totals.totalInclVat,
        depositAmount,
        invoiceNumber: invoiceNow?.number || undefined,
        invoicePdfUrl: invoiceNow
          ? buildInvoiceLinkSnippet(b.id).url
          : undefined,
      };

      const internalReact: ReactElement = await buildInternalEmail(
        internalView,
        source as MailerNotifySource
      );

      const internalSubject = `New CONFIRMED booking #${b.id}: ${machineName} · ${startYmd}–${endYmd}`;

      internalPromise = sendEmail({
        to: ADMIN_TO,
        subject: internalSubject,
        react: internalReact,
      });
    }
    // else: another concurrent path already sent it; no-op.
  }

  // 5) Fire both in parallel; contain failures
  await Promise.allSettled([customerPromise, internalPromise]);
}
