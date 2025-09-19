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

/** Format Date → "YYYY-MM-DD" (UTC) for templates */
function toYmdUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Prisma Decimal-safe → number */
function decimalToNumber(value: unknown): number {
  if (typeof value === "number") return value;
  const anyVal = value as any;
  if (anyVal && typeof anyVal.toNumber === "function") return anyVal.toNumber();
  return Number(value ?? 0);
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

/**
 * notifyBookingConfirmed
 * Loads the booking and sends two emails:
 *  - Customer confirmation (if we have a customerEmail)
 *  - Internal notification to ADMIN_TO
 *
 * Never throws. Uses sendEmail() which already contains dry-run behavior.
 */
export async function notifyBookingConfirmed(
  bookingId: number,
  source: NotifySource
): Promise<void> {
  // 1) Load what we need for both templates (keep select minimal)
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

      // add-on and fulfilment flags
      insuranceSelected: true,
      deliverySelected: true,
      pickupSelected: true,
      operatorSelected: true,

      totalCost: true, // assumed VAT-inclusive
      depositPaid: true, // operational flag

      invoiceNumber: true,
      invoicePdfUrl: true,

      machine: { select: { name: true, deposit: true } },
    },
  });
  if (!b) return;

  // 2) Common derivations
  const startYmd = toYmdUTC(b.startDate);
  const endYmd = toYmdUTC(b.endDate);
  const machineName = b.machine?.name ?? `Machine #${b.machineId}`;
  const days = rentalDaysInclusive(b.startDate, b.endDate);

  const totalInclNumber = decimalToNumber(b.totalCost);
  const money = splitVatFromTotal(totalInclNumber);
  const depositNumber = decimalToNumber(b.machine?.deposit ?? 0);

  // Single-line address for templates
  const siteAddress = [b.siteAddressLine1 || "", b.siteAddressCity || ""]
    .filter(Boolean)
    .join(", ");

  const addonsList = makeAddonsList({
    operatorSelected: b.operatorSelected,
    insuranceSelected: b.insuranceSelected,
    deliverySelected: b.deliverySelected,
    pickupSelected: b.pickupSelected,
  });

  // build a signed proxy URL for internal email if an invoice exists
  const invoiceProxyUrl = b.invoicePdfUrl
    ? buildInvoiceLinkSnippet(b.id).url
    : undefined;

  // 3) Customer email (optional) — SKIP for ops-created bookings and internal placeholders
  const isInternalPlaceholder = (b.customerEmail || "")
    .toLowerCase()
    .endsWith("@internal.local");
  let customerPromise: Promise<unknown> = Promise.resolve();

  if (source !== "ops" && b.customerEmail && !isInternalPlaceholder) {
    const react: ReactElement = (
      <BookingConfirmedEmail
        companyName={COMPANY_NAME}
        companyEmail={COMPANY_EMAIL}
        supportPhone={SUPPORT_PHONE}
        companySite={COMPANY_WEBSITE}
        customerName={b.customerName || undefined}
        bookingId={b.id}
        machineName={machineName}
        startYmd={startYmd}
        endYmd={endYmd}
        rentalDays={days}
        addonsList={addonsList}
        deliverySelected={b.deliverySelected}
        pickupSelected={b.pickupSelected}
        siteAddress={siteAddress || null}
        subtotalExVat={money.subtotalExVat}
        vatAmount={money.vatAmount}
        totalInclVat={money.totalInclVat}
        depositAmount={toMoneyString(depositNumber)}
        invoicePdfUrl={b.invoicePdfUrl || undefined}
        warehouseAddress={WAREHOUSE_ADDRESS}
        warehouseHours={WAREHOUSE_HOURS}
        callByDateTimeLocal={null}
        machineAccessNote={null}
      />
    );

    customerPromise = sendEmail({
      to: b.customerEmail,
      subject: "Your AMR booking is confirmed: next steps",
      react,
    });
  }

  // 4) Internal email (always)
  const internalReact: ReactElement = (
    <BookingInternalEmail
      companyName={COMPANY_NAME}
      adminEmail={COMPANY_EMAIL}
      source={source}
      bookingId={b.id}
      machineId={b.machineId}
      machineName={machineName}
      startYmd={startYmd}
      endYmd={endYmd}
      rentalDays={days}
      customerName={b.customerName || undefined}
      customerEmail={b.customerEmail || undefined}
      customerPhone={b.customerPhone || undefined}
      siteAddress={siteAddress || undefined}
      addonsList={addonsList}
      deliverySelected={b.deliverySelected}
      pickupSelected={b.pickupSelected}
      heavyLeadTimeApplies={[5, 6, 7].includes(b.machineId)}
      geofenceStatus={"inside"} // TODO: plug real check when available
      subtotalExVat={money.subtotalExVat}
      vatAmount={money.vatAmount}
      totalInclVat={money.totalInclVat}
      depositAmount={toMoneyString(depositNumber)}
      opsUrlForBooking={APP_URL ? `${APP_URL}/ops` : "#"}
      stripePiId={undefined}
      stripePiUrl={undefined}
      invoiceNumber={b.invoiceNumber || undefined}
      invoicePdfUrl={invoiceProxyUrl || undefined}
      googleCalendarEventId={undefined}
      googleHtmlLink={undefined}
    />
  );

  const internalSubject = `New CONFIRMED booking #${b.id}: ${machineName} · ${startYmd}–${endYmd}`;

  const internalPromise = sendEmail({
    to: ADMIN_TO,
    subject: internalSubject,
    react: internalReact,
  });

  // 5) Fire both in parallel; contain all failures
  await Promise.allSettled([customerPromise, internalPromise]);
}
