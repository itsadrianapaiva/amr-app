"use server";
import "server-only";
import type { ReactElement } from "react";
import BookingInternalEmail from "@/lib/emails/templates/booking-internal";

export type InternalConfirmedView = {
  id: number;
  machineId: number;
  machineName: string;
  startYmd: string;
  endYmd: string;
  rentalDays: number;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  siteAddress?: string;
  addonsList: string;
  subtotalExVat: string;
  vatAmount: string;
  totalInclVat: string;
  depositAmount: string;
  invoiceNumber?: string;
  invoicePdfUrl?: string;
};

export type NotifySource = "customer" | "ops";

const COMPANY_NAME = process.env.COMPANY_NAME || "Algarve Machinery Rental";
const COMPANY_EMAIL =
  process.env.EMAIL_REPLY_TO ||
  process.env.SUPPORT_EMAIL ||
  "support@amr-rentals.com";
const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "";

/**
 * buildInternalEmail
 * Async to satisfy Next.js server action inference rules for exported server functions.
 */
export async function buildInternalEmail(
  view: InternalConfirmedView,
  source: NotifySource
): Promise<ReactElement> {
  const opsUrlForBooking = APP_URL ? `${APP_URL}/ops` : "#";

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
      subtotalExVat={view.subtotalExVat}
      vatAmount={view.vatAmount}
      totalInclVat={view.totalInclVat}
      depositAmount={view.depositAmount}
      opsUrlForBooking={opsUrlForBooking}
      stripePiId={undefined}
      stripePiUrl={undefined}
      invoiceNumber={view.invoiceNumber || undefined}
      invoicePdfUrl={view.invoicePdfUrl}
      googleCalendarEventId={undefined}
      googleHtmlLink={undefined}
    />
  );
}
