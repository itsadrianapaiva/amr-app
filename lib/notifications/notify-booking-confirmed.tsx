"use server";
import "server-only";
import type { ReactElement } from "react";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/emails/mailer";
import BookingConfirmedEmail from "@/lib/emails/templates/booking-confirmed";
import BookingInternalEmail from "@/lib/emails/templates/booking-internal";

/** Narrow, explicit input. Keep this module single-purpose. */
export type NotifySource = "customer" | "ops";

/** Env-backed config with safe defaults for dev/dry-run. */
const COMPANY_NAME = process.env.COMPANY_NAME || "Algarve Machinery Rental";
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "amr.business.pt@gmail.com";
const ADMIN_TO = (process.env.EMAIL_ADMIN_TO || "amr.business.pt@gmail.com")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "";

/** Format Date → "YYYY-MM-DD" (UTC) for templates */
function toYmdUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
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
  // 1) Load only what we need
  const b = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      machineId: true,
      startDate: true,
      endDate: true,
      customerName: true,
      customerEmail: true,
      siteAddressLine1: true,
      siteAddressCity: true,
      depositPaid: true,
      totalCost: true,
      machine: { select: { name: true } },
    },
  });
  if (!b) return;

  // 2) Prepare shared props
  const startYmd = toYmdUTC(b.startDate);
  const endYmd = toYmdUTC(b.endDate);

  // Prefer the machine name; fall back to "Machine #<id>" just in case
  const machineTitle = b.machine?.name ?? `Machine #${b.machineId}`;

  // 3) Customer email (optional)
  let customerPromise: Promise<unknown> = Promise.resolve();
  if (b.customerEmail) {
    const depositAmount = b.depositPaid ? Number(b.totalCost) : null;

    const react: ReactElement = (
      <BookingConfirmedEmail
        companyName={COMPANY_NAME}
        supportEmail={SUPPORT_EMAIL}
        bookingId={b.id}
        customerName={b.customerName}
        machineTitle={machineTitle}
        startYmd={startYmd}
        endYmd={endYmd}
        depositPaidEuros={depositAmount}
        siteAddressLine1={b.siteAddressLine1}
        siteAddressCity={b.siteAddressCity}
      />
    );

    customerPromise = sendEmail({
      to: b.customerEmail,
      subject: `${COMPANY_NAME}: Booking confirmed #${b.id}`,
      replyTo: SUPPORT_EMAIL,
      react,
    });
  }

  // 4) Internal email (always)
  const opsUrl = APP_URL ? `${APP_URL}/ops` : null;
  const internalReact: ReactElement = (
    <BookingInternalEmail
      companyName={COMPANY_NAME}
      adminEmail={SUPPORT_EMAIL}
      bookingId={b.id}
      source={source}
      machineTitle={machineTitle}
      startYmd={startYmd}
      endYmd={endYmd}
      customerName={b.customerName}
      customerEmail={b.customerEmail}
      siteAddressLine1={b.siteAddressLine1}
      siteAddressCity={b.siteAddressCity}
      depositPaid={b.depositPaid}
      opsUrl={opsUrl}
    />
  );

  const internalPromise = sendEmail({
    to: ADMIN_TO,
    subject: `${COMPANY_NAME}: new booking #${b.id} (${source})`,
    replyTo: SUPPORT_EMAIL,
    react: internalReact,
  });

  // 5) Fire both in parallel; contain all failures
  await Promise.allSettled([customerPromise, internalPromise]);
}
