"use server";
import "server-only";
import type { ReactElement } from "react";
import BookingInternalEmail from "@/lib/emails/templates/booking-internal";
import { getInternalBranding } from "@/lib/emails/branding";

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
  deliverySelected?: boolean;
  pickupSelected?: boolean;
};

export type NotifySource = "customer" | "ops";

// Keep URL logic local; branding focuses on identity/emails.
const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "";

/**
 * buildInternalEmail
 * Async to satisfy Next.js server action inference rules for exported server functions.
 */
export async function buildInternalEmail(
  view: InternalConfirmedView,
  source: NotifySource
): Promise<ReactElement> {
  // Centralized Ops identity + admin recipient
  const { companyName, adminEmail } = await getInternalBranding();

  const opsUrlForBooking = APP_URL ? `${APP_URL}/ops` : "#";

  return (
    <BookingInternalEmail
      companyName={companyName}
      adminEmail={adminEmail}
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
      deliverySelected={Boolean(view.deliverySelected)}
      pickupSelected={Boolean(view.pickupSelected)}
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
