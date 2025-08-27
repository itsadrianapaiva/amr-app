"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { BookingStatus } from "@prisma/client";
import { createAllDayEvent } from "@/lib/google-calendar";

// Accept minimal customer + address fields required by the Booking schema
const ManagerBookingSchema = z.object({
  passcode: z.string().min(1, "Missing passcode"),
  machineId: z.number().int().positive(),
  // Dates as calendar strings
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  // Add-ons (safe defaults)
  delivery: z.boolean().optional().default(false),
  pickup: z.boolean().optional().default(false),
  insurance: z.boolean().optional().default(false),
  operator: z.boolean().optional().default(false),
  // Customer (Booking schema requires these—defaults keep testing easy)
  customerName: z.string().min(1).default("OPS Booking"),
  customerEmail: z.string().email().default("ops@example.com"),
  customerPhone: z.string().min(3).default("000000000"),
  customerNIF: z.string().optional().nullable(),
  // Operational site address (not invoicing) — map to 4 columns on write
  siteAddress: z
    .object({
      line1: z.string().optional().nullable(),
      postalCode: z.string().optional().nullable(),
      city: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    })
    .optional(),
  // Optional explicit total for ops; default to 0 for “waived” bookings
  totalCost: z.number().nonnegative().default(0),
});

type ManagerBookingInput = z.infer<typeof ManagerBookingSchema>;

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
  if (parsed.passcode !== expected) throw new Error("Unauthorized: invalid passcode");

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
        ? `City/Postal: ${[parsed.siteAddress?.postalCode, parsed.siteAddress?.city]
            .filter(Boolean)
            .join(" ")}`
        : null,
      parsed.siteAddress?.notes ? `Notes: ${parsed.siteAddress.notes}` : null,
      `Payment: WAIVED (ops)`,
    ].filter(Boolean);

    const eventId = await createAllDayEvent({
      summary: `AMR Rental – ${machine.name}`,
      description: lines.join("\n"),
      startDate: parsed.startDate, // inclusive
      endDate: parsed.endDate,     // inclusive; helper adds +1 day for Google
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
