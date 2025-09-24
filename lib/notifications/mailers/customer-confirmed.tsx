"use server";
import "server-only";
import type { ReactElement } from "react";
import BookingConfirmedEmail from "@/lib/emails/templates/booking-confirmed";
import { getEmailBranding } from "@/lib/emails/branding"; // NEW

export type CustomerConfirmedView = {
  id: number;
  machineName: string;
  startYmd: string;
  endYmd: string;
  rentalDays: number;
  customerName?: string | null;
  siteAddress?: string | null;
  subtotalExVat: string;
  vatAmount: string;
  totalInclVat: string;
  depositAmount: string;
  invoicePdfUrl?: string;
};

/**
 * buildCustomerEmail
 * Async to satisfy Next.js server action inference rules for exported server functions.
 * Returns a ReactElement wrapped in a Promise.
 */
export async function buildCustomerEmail(
  view: CustomerConfirmedView
): Promise<ReactElement> {
  // Centralized, consistent company/contact data
  const {
    companyName,
    companyEmail,
    supportPhone,
    companySite,
    warehouseAddress,
    warehouseHours,
  } = await getEmailBranding();

  return (
    <BookingConfirmedEmail
      companyName={companyName}
      companyEmail={companyEmail}
      supportPhone={supportPhone}
      companySite={companySite}
      customerName={view.customerName || undefined}
      bookingId={view.id}
      machineName={view.machineName}
      startYmd={view.startYmd}
      endYmd={view.endYmd}
      rentalDays={view.rentalDays}
      deliverySelected={false}
      pickupSelected={false}
      siteAddress={view.siteAddress || null}
      subtotalExVat={view.subtotalExVat}
      vatAmount={view.vatAmount}
      totalInclVat={view.totalInclVat}
      depositAmount={view.depositAmount}
      invoicePdfUrl={view.invoicePdfUrl}
      warehouseAddress={warehouseAddress}
      warehouseHours={warehouseHours}
      callByDateTimeLocal={null}
      machineAccessNote={null}
    />
  );
}
