"use server";
import "server-only";
import type { ReactElement } from "react";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/emails/mailer";
import BookingConfirmedEmail from "@/lib/emails/templates/booking-confirmed";
import BookingInternalEmail from "@/lib/emails/templates/booking-internal";
import { buildInvoiceLinkSnippet } from "../emails/invoice-link";

/** Narrow, explicit input. Keep this module single-purpose. */
export type NotifySource = "customer" | "ops";

/** Env-backed config with safe defaults for dev/dry-run. */
const COMPANY_NAME = process.env.COMPANY_NAME || "Algarve Machinery Rental";
const COMPANY_EMAIL =
  process.env.EMAIL_REPLY_TO ||
  process.env.SUPPORT_EMAIL ||
  "support@amr-rentals.com";
const SUPPORT_PHONE = process.env.SUPPORT_PHONE || "351934014611";
const COMPANY_WEBSITE =
  process.env.COMPANY_WEBSITE || "https://amr-rentals.com";

/** Admin recipients (comma-separated) for internal notifications. */
const ADMIN_TO = (
  process.env.EMAIL_ADMIN_TO ||
  process.env.ADMIN_TO ||
  "amr.business.pt@gmail.com"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/** Logistics (customer “what happens next”). */
const WAREHOUSE_ADDRESS = process.env.WAREHOUSE_ADDRESS || "AMR Warehouse";
const WAREHOUSE_HOURS = process.env.WAREHOUSE_HOURS || "Mon–Fri 09:00–17:00";

/** Public URL for Ops deep links in internal mail. */
const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "";

/** Utilities */
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

/** Lightweight record for email rendering */
type BookingEmailView = {
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
  totals: { subtotalExVat: string; vatAmount: string; totalInclVat: string };
  depositAmount: string;
  invoiceNumber?: string | null;
  invoicePdfUrl?: string; // signed proxy URL, if present
};

/** Map DB row → light view model */
function toEmailView(b: any): BookingEmailView {
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
    totals,
    depositAmount,
    invoiceNumber: b.invoiceNumber || undefined,
    invoicePdfUrl: signed?.url,
  };
}

/** Build React elements (kept tiny and pure) */
function buildCustomerEmail(view: BookingEmailView): ReactElement {
  return (
    <BookingConfirmedEmail
      companyName={COMPANY_NAME}
      companyEmail={COMPANY_EMAIL}
      supportPhone={SUPPORT_PHONE}
      companySite={COMPANY_WEBSITE}
      customerName={view.customerName || undefined}
      bookingId={view.id}
      machineName={view.machineName}
      startYmd={view.startYmd}
      endYmd={view.endYmd}
      rentalDays={view.rentalDays}
      addonsList={view.addonsList}
      deliverySelected={false /* legacy flag not shown in template */}
      pickupSelected={false /* legacy flag not shown in template */}
      siteAddress={view.siteAddress || null}
      subtotalExVat={view.totals.subtotalExVat}
      vatAmount={view.totals.vatAmount}
      totalInclVat={view.totals.totalInclVat}
      depositAmount={view.depositAmount}
      invoicePdfUrl={view.invoicePdfUrl /* may be undefined */}
      warehouseAddress={WAREHOUSE_ADDRESS}
      warehouseHours={WAREHOUSE_HOURS}
      callByDateTimeLocal={null}
      machineAccessNote={null}
    />
  );
}

function buildInternalEmail(
  view: BookingEmailView,
  source: NotifySource
): ReactElement {
  return (
    <BookingInternalEmail
      companyName={COMPANY_NAME}
      adminEmail={COMPANY_EMAIL}
      source={source}
      bookingId={view.id}
      machineId={view.machineId}
      machineName={view.machineName}
      startYmd={view.startYmd}
      endYmd={view.endYmd}
      rentalDays={view.rentalDays}
      customerName={view.customerName || undefined}
      customerEmail={view.customerEmail || undefined}
      customerPhone={view.customerPhone || undefined}
      siteAddress={view.siteAddress || undefined}
      addonsList={view.addonsList}
      deliverySelected={false}
      pickupSelected={false}
      heavyLeadTimeApplies={[5, 6, 7].includes(view.machineId)}
      geofenceStatus={"inside"}
      subtotalExVat={view.totals.subtotalExVat}
      vatAmount={view.totals.vatAmount}
      totalInclVat={view.totals.totalInclVat}
      depositAmount={view.depositAmount}
      opsUrlForBooking={APP_URL ? `${APP_URL}/ops` : "#"}
      stripePiId={undefined}
      stripePiUrl={undefined}
      invoiceNumber={view.invoiceNumber || undefined}
      invoicePdfUrl={view.invoicePdfUrl}
      googleCalendarEventId={undefined}
      googleHtmlLink={undefined}
    />
  );
}

/**
 * notifyBookingConfirmed
 * Policy:
 * - Send confirmation email exactly once.
 * - If invoice exists at that time, include link AND mark invoiceEmailSentAt,
 *   so later notify-invoice-ready will no-op (max two emails rule).
 * - Always send internal email.
 */
export async function notifyBookingConfirmed(
  bookingId: number,
  source: NotifySource
): Promise<void> {
  // 1) Fetch lean booking
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

  const view = toEmailView(b);
  const isInternalPlaceholder = (b.customerEmail || "")
    .toLowerCase()
    .endsWith("@internal.local");
  const hasInvoiceNow = !!b.invoiceNumber && !!b.invoicePdfUrl;

  // 2) Customer confirmation — atomic claim
  let customerPromise: Promise<unknown> = Promise.resolve();
  if (source !== "ops" && b.customerEmail && !isInternalPlaceholder) {
    // If invoice exists now, claim both confirmation and invoice email in one shot.
    const data: Record<string, Date> = { confirmationEmailSentAt: new Date() };
    const where: any = { id: b.id, confirmationEmailSentAt: null };

    if (hasInvoiceNow) {
      data.invoiceEmailSentAt = new Date();
      // Note: do NOT add invoiceEmailSentAt:null to the WHERE clause; we want to allow the
      // case where invoice email was already sent by a race (rare) without blocking confirm.
    }

    const claim = await db.booking.updateMany({ where, data });

    if (claim.count === 1) {
      const react = buildCustomerEmail(view);
      customerPromise = sendEmail({
        to: b.customerEmail,
        subject: "Your AMR booking is confirmed: next steps",
        react,
      });
    }
  }

  // 3) Internal email — always
  const internalReact = buildInternalEmail(view, source);
  const internalSubject = `New CONFIRMED booking #${view.id}: ${view.machineName} · ${view.startYmd}–${view.endYmd}`;
  const internalPromise = sendEmail({
    to: ADMIN_TO,
    subject: internalSubject,
    react: internalReact,
  });

  // 4) Fire both in parallel; swallow individual failures
  await Promise.allSettled([customerPromise, internalPromise]);
}
