"use server";
import "server-only";
import type { ReactElement } from "react";
import BookingInternalEmail from "@/lib/emails/templates/booking-internal";

/**
 * InternalConfirmedView
 * Minimal, template-oriented shape for the internal notification.
 * Keeps this mailer decoupled from Prisma models.
 */
export type InternalConfirmedView = {
  id: number;
  machineId: number;
  machineName: string;

  startYmd: string;                // YYYY-MM-DD (UTC)
  endYmd: string;                  // YYYY-MM-DD (UTC)
  rentalDays: number;

  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;

  siteAddress?: string;

  addonsList: string;

  subtotalExVat: string;           // "123.45"
  vatAmount: string;               // "28.39"
  totalInclVat: string;            // "151.84"
  depositAmount: string;           // "250.00"

  invoiceNumber?: string;
  invoicePdfUrl?: string;          // signed proxy URL if present
};

/** Who triggered the notification (for template context). */
export type NotifySource = "customer" | "ops";

/** Env-backed config (server-only). Defaults are safe for dev. */
const COMPANY_NAME = process.env.COMPANY_NAME || "Algarve Machinery Rental";
const COMPANY_EMAIL =
  process.env.EMAIL_REPLY_TO ||
  process.env.SUPPORT_EMAIL ||
  "support@amr-rentals.com";

/** Public URL for Ops deep links in internal mail. */
const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "";

/**
 * buildInternalEmail
 * Pure renderer for the internal notification — no DB, no I/O, just JSX.
 */
export function buildInternalEmail(
  view: InternalConfirmedView,
  source: NotifySource
): ReactElement {
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
      // Operational flags not shown in the current template; keep false.
      deliverySelected={false}
      pickupSelected={false}
      // Simple heuristic preserved from previous code (can be replaced by real rule).
      heavyLeadTimeApplies={[5, 6, 7].includes(view.machineId)}
      geofenceStatus={"inside"} // TODO: wire real geofence when available
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
