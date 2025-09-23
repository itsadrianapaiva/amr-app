"use server";
import "server-only";
import type { ReactElement } from "react";
import BookingConfirmedEmail from "@/lib/emails/templates/booking-confirmed";

/**
 * CustomerConfirmedView
 * Minimal view model required by the BookingConfirmedEmail template.
 * Keeping it here avoids coupling this mailer to DB or Prisma types.
 */
export type CustomerConfirmedView = {
  id: number;
  machineName: string;
  startYmd: string;               // YYYY-MM-DD (UTC)
  endYmd: string;                 // YYYY-MM-DD (UTC)
  rentalDays: number;

  customerName?: string | null;
  siteAddress?: string | null;

  subtotalExVat: string;          // "123.45"
  vatAmount: string;              // "28.39"
  totalInclVat: string;           // "151.84"
  depositAmount: string;          // "250.00"

  invoicePdfUrl?: string;         // signed proxy URL if available
};

/** Env-backed config (server-only). Keep defaults safe for dev. */
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
 * Pure renderer: no DB access, no side effects.
 * Returns the React email element to be passed to the mailer.
 */
export function buildCustomerEmail(view: CustomerConfirmedView): ReactElement {
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
      // The legacy per-add-on booleans aren’t shown in the current template; keep disabled.
      deliverySelected={false}
      pickupSelected={false}
      siteAddress={view.siteAddress || null}
      subtotalExVat={view.subtotalExVat}
      vatAmount={view.vatAmount}
      totalInclVat={view.totalInclVat}
      depositAmount={view.depositAmount}
      // Include the signed invoice link when available (undefined hides the block).
      invoicePdfUrl={view.invoicePdfUrl}
      warehouseAddress={WAREHOUSE_ADDRESS}
      warehouseHours={WAREHOUSE_HOURS}
      // Optional fields not currently used by the template
      callByDateTimeLocal={null}
      machineAccessNote={null}
    />
  );
}
