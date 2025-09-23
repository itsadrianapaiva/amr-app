"use server";
import "server-only";
import type { ReactElement } from "react";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/emails/mailer";
import { buildInvoiceLinkSnippet } from "@/lib/emails/invoice-link";

// extracted mailers
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

/** Utilities (tiny and local) */
function toYmdUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function decimalToNumber(value: unknown): number {
  if (typeof value === "number") return value;
  const anyVal = value as any;
  return anyVal && typeof anyVal.toNumber === "function"
    ? anyVal.toNumber()
    : Number(value ?? 0);
}
function toMoneyString(n: number): string {
  return n.toFixed(2);
}
function rentalDaysInclusive(start: Date, end: Date): number {
  const ms =
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()) -
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const diff = Math.round(ms / 86_400_000);
  return Math.max(1, diff + 1);
}
function splitVatFromTotal(totalIncl: number) {
  const ex = totalIncl / 1.23;
  const vat = totalIncl - ex;
  return {
    subtotalExVat: toMoneyString(ex),
    vatAmount: toMoneyString(vat),
    totalInclVat: toMoneyString(totalIncl),
  };
}
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

/** Common lean view built once, then mapped to each mailer’s view type. */
type BookingCommonView = {
  id: number;
  machineId: number;
  machineName: string;
  startYmd: string;
  endYmd: string;
  rentalDays: number;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  siteAddress?: string;
  addonsList: string;
  subtotalExVat: string;
  vatAmount: string;
  totalInclVat: string;
  depositAmount: string;
  invoiceNumber?: string | null;
  invoicePdfUrl?: string; // signed proxy URL if present
};

function toCommonView(b: any): BookingCommonView {
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
  const hasInvoice = !!b.invoiceNumber && !!b.invoicePdfUrl;
  const signed = hasInvoice ? buildInvoiceLinkSnippet(b.id) : undefined;

  return {
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
}

/**
 * notifyBookingConfirmed
 * Policy:
 * - Send confirmation exactly once.
 * - If invoice exists at that time, include link AND mark invoiceEmailSentAt,
 *   so later notify-invoice-ready will no-op (max two emails for customer).
 * - Always send internal email (duplicate internal sends from multiple Stripe events
 *   are acceptable for now; we can add a DB flag later if needed).
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

  const viewCommon = toCommonView(b);
  const isInternalPlaceholder = (b.customerEmail || "")
    .toLowerCase()
    .endsWith("@internal.local");
  const hasInvoiceNow = !!b.invoiceNumber && !!b.invoicePdfUrl;

  // 2) Customer confirmation — atomic claim
  let customerPromise: Promise<unknown> = Promise.resolve();
  if (source !== "ops" && b.customerEmail && !isInternalPlaceholder) {
    const data: Record<string, Date> = { confirmationEmailSentAt: new Date() };
    const where: any = { id: b.id, confirmationEmailSentAt: null };

    if (hasInvoiceNow) {
      data.invoiceEmailSentAt = new Date();
    }

    const claim = await db.booking.updateMany({ where, data });

    if (claim.count === 1) {
      // Map to the customer mailer’s view
      const customerView: CustomerConfirmedView = {
        id: viewCommon.id,
        machineName: viewCommon.machineName,
        startYmd: viewCommon.startYmd,
        endYmd: viewCommon.endYmd,
        rentalDays: viewCommon.rentalDays,
        customerName: viewCommon.customerName,
        siteAddress: viewCommon.siteAddress || null,
        subtotalExVat: viewCommon.subtotalExVat,
        vatAmount: viewCommon.vatAmount,
        totalInclVat: viewCommon.totalInclVat,
        depositAmount: viewCommon.depositAmount,
        invoicePdfUrl: viewCommon.invoicePdfUrl, // optional
      };

      const react: ReactElement = buildCustomerEmail(customerView);
      customerPromise = sendEmail({
        to: b.customerEmail,
        subject: "Your AMR booking is confirmed: next steps",
        react,
      });
    }
  }

  // 3) Internal email — always
  const internalView: InternalConfirmedView = {
    id: viewCommon.id,
    machineId: viewCommon.machineId,
    machineName: viewCommon.machineName,
    startYmd: viewCommon.startYmd,
    endYmd: viewCommon.endYmd,
    rentalDays: viewCommon.rentalDays,
    customerName: viewCommon.customerName || undefined,
    customerEmail: viewCommon.customerEmail || undefined,
    customerPhone: viewCommon.customerPhone || undefined,
    siteAddress: viewCommon.siteAddress || undefined,
    addonsList: viewCommon.addonsList,
    subtotalExVat: viewCommon.subtotalExVat,
    vatAmount: viewCommon.vatAmount,
    totalInclVat: viewCommon.totalInclVat,
    depositAmount: viewCommon.depositAmount,
    invoiceNumber: viewCommon.invoiceNumber || undefined,
    invoicePdfUrl: viewCommon.invoicePdfUrl,
  };

  const internalReact: ReactElement = buildInternalEmail(
    internalView,
    source as MailerNotifySource
  );
  const internalSubject = `New CONFIRMED booking #${viewCommon.id}: ${viewCommon.machineName} · ${viewCommon.startYmd}–${viewCommon.endYmd}`;

  const internalPromise = sendEmail({
    to: ADMIN_TO,
    subject: internalSubject,
    react: internalReact,
  });

  // 4) Fire both in parallel; contain failures
  await Promise.allSettled([customerPromise, internalPromise]);
}
