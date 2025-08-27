"use server";

import { db } from "@/lib/db";
import { BookingStatus } from "@prisma/client";
import { createAllDayEvent } from "@/lib/google-calendar";
import {
  ManagerBookingSchema,
  type ManagerBookingInput,
} from "@/lib/validation/manager-booking";

/**
 * Internal-only action: create a CONFIRMED booking with payment waived.
 * - Validates passcode (OPS_PASSCODE).
 * - Writes Booking with startDate/endDate + required customer fields.
 * - Writes Google Calendar all-day event (best-effort).
 * - Persists googleCalendarEventId.
 */
export async function createManagerBooking(input: ManagerBookingInput) {
  // 1) Validate and auth
  const parsed = ManagerBookingSchema.parse(input);
  const expected = process.env.OPS_PASSCODE;
  if (!expected) throw new Error("Server misconfigured: missing OPS_PASSCODE");
  if (parsed.passcode !== expected)
    throw new Error("Unauthorized: invalid passcode");

  // 2) Ensure machine exists (for Calendar title)
  const machine = await db.machine.findUnique({
    where: { id: parsed.machineId },
    select: { id: true, name: true },
  });
  if (!machine) throw new Error("Machine not found");

  // 3) Convert YYYY-MM-DD -> UTC midnight Date for DB columns
  const toUtcMidnight = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);
  const startAt = toUtcMidnight(parsed.startDate);
  const endAt = toUtcMidnight(parsed.endDate);

  // 4) Create booking (confirmed, deposit waived)
  const waivedId = `WAIVED_${Date.now()}`;
  const booking = await db.booking.create({
    data: {
      machineId: parsed.machineId,
      status: BookingStatus.CONFIRMED,

      // Schema-aligned date columns
      startDate: startAt,
      endDate: endAt,

      // Required customer fields
      customerName: parsed.customerName,
      customerEmail: parsed.customerEmail,
      customerPhone: parsed.customerPhone,
      customerNIF: parsed.customerNIF ?? null,

      // Operational site address — map to 4 separate columns
      siteAddressLine1: parsed.siteAddress?.line1 ?? null,
      siteAddressPostalCode: parsed.siteAddress?.postalCode ?? null,
      siteAddressCity: parsed.siteAddress?.city ?? null,
      siteAddressNotes: parsed.siteAddress?.notes ?? null,

      // Add-ons
      insuranceSelected: parsed.insurance,
      deliverySelected: parsed.delivery,
      pickupSelected: parsed.pickup,
      operatorSelected: parsed.operator,

      // Money & ops: totalCost required by schema; deposit is waived
      totalCost: parsed.totalCost,
      depositPaid: true,
      stripePaymentIntentId: waivedId,
    },
    select: { id: true },
  });

  // 5) Best-effort Calendar write
  try {
    const addOns: string[] = [];
    if (parsed.delivery) addOns.push("Delivery");
    if (parsed.pickup) addOns.push("Pickup");
    if (parsed.insurance) addOns.push("Insurance");
    if (parsed.operator) addOns.push("Operator");

    const lines = [
      `Booking #${booking.id}`,
      `Dates: ${parsed.startDate} → ${parsed.endDate}`,
      addOns.length ? `Add-ons: ${addOns.join(", ")}` : null,
      parsed.siteAddress?.line1 ? `Site: ${parsed.siteAddress.line1}` : null,
      parsed.siteAddress?.postalCode || parsed.siteAddress?.city
        ? `City/Postal: ${[
            parsed.siteAddress?.postalCode,
            parsed.siteAddress?.city,
          ]
            .filter(Boolean)
            .join(" ")}`
        : null,
      parsed.siteAddress?.notes ? `Notes: ${parsed.siteAddress.notes}` : null,
      `Booked by: ${parsed.managerName}`,
      `Payment: WAIVED (OPS)`,
    ].filter(Boolean);

    const eventId = await createAllDayEvent({
      summary: `AMR Rental – ${machine.name}`,
      description: lines.join("\n"),
      startDate: parsed.startDate, // inclusive
      endDate: parsed.endDate, // inclusive; helper adds +1 day for Google
      location: parsed.siteAddress?.line1 || undefined,
    });

    await db.booking.update({
      where: { id: booking.id },
      data: { googleCalendarEventId: eventId },
    });

    return { ok: true, bookingId: booking.id, eventId };
  } catch (err) {
    console.error("Manager booking created but Calendar write failed:", err);
    return { ok: true, bookingId: booking.id, eventId: null };
  }
}
