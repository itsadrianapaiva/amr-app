"use server";
import "server-only";
import type { ReactElement } from "react";
import BookingConfirmedEmail from "@/lib/emails/templates/booking-confirmed";

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

const COMPANY_NAME = process.env.COMPANY_NAME || "Algarve Machinery Rental";
const COMPANY_EMAIL =
  process.env.EMAIL_REPLY_TO ||
  process.env.SUPPORT_EMAIL ||
  "support@amr-rentals.com";
const SUPPORT_PHONE = process.env.SUPPORT_PHONE || "351934014611";
const COMPANY_WEBSITE =
  process.env.COMPANY_WEBSITE || "https://amr-rentals.com";
const WAREHOUSE_ADDRESS = process.env.WAREHOUSE_ADDRESS || "AMR Warehouse";
const WAREHOUSE_HOURS = process.env.WAREHOUSE_HOURS || "Mon–Fri 09:00–17:00";

/**
 * buildCustomerEmail
 * Async to satisfy Next.js server action inference rules for exported server functions.
 * Returns a ReactElement wrapped in a Promise.
 */
export async function buildCustomerEmail(
  view: CustomerConfirmedView
): Promise<ReactElement> {
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
      deliverySelected={false}
      pickupSelected={false}
      siteAddress={view.siteAddress || null}
      subtotalExVat={view.subtotalExVat}
      vatAmount={view.vatAmount}
      totalInclVat={view.totalInclVat}
      depositAmount={view.depositAmount}
      invoicePdfUrl={view.invoicePdfUrl}
      warehouseAddress={WAREHOUSE_ADDRESS}
      warehouseHours={WAREHOUSE_HOURS}
      callByDateTimeLocal={null}
      machineAccessNote={null}
    />
  );
}
