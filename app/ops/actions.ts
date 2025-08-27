"use server";

/**
 * Create a CONFIRMED booking from the internal /ops console.
 * - Uses Zod v4's top-level z.flattenError() for field/form errors (no thrown user errors).
 * - Matches Prisma schema exactly (customerEmail, customerPhone, totalCost, etc.).
 * - Calendar write is best-effort and non-blocking.
 */

import * as z from "zod";
import { db } from "@/lib/db";
import { ManagerBookingSchema } from "@/lib/validation/manager-booking";
import { createAllDayEvent } from "@/lib/google-calendar";
import { BookingStatus } from "@prisma/client";

// Types
export type ManagerBookingActionResult =
  | {
      ok: true;
      bookingId: number;
      calendar?: { eventId: string | null };
    }
  | {
      ok: false;
      formError?: string;
      fieldErrors?: Record<string, string[]>;
    };

// Helpers

/** Convert "YYYY-MM-DD" to a Date at UTC midnight. */
function ymdToUtcStart(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

/** Friendly message for overlap. */
function overlapMessage() {
  return "These dates are already booked for the selected machine. Choose a different range.";
}

/** Prepare minimal customer details with safe defaults for Prisma non-null cols. */
function buildCustomerDefaults(input: Record<string, any>) {
  const name =
    typeof input.customerName === "string" &&
    input.customerName.trim().length > 0
      ? input.customerName.trim()
      : "Not included";
  const email =
    typeof input.customerEmail === "string" &&
    input.customerEmail.trim().length > 0
      ? input.customerEmail.trim()
      : "ops@bookings.com"; // RFC-reserved TLD
  const phone =
    typeof input.customerPhone === "string" &&
    input.customerPhone.trim().length > 0
      ? input.customerPhone.trim()
      : "N/A";
  const nif =
    typeof input.customerNIF === "string" && input.customerNIF.trim().length > 0
      ? input.customerNIF.trim()
      : null;

  return { name, email, phone, nif };
}

/** Simple CONFIRMED-overlap check. */
async function hasConfirmedOverlap(
  machineId: number,
  startAt: Date,
  endAt: Date
) {
  const overlapping = await db.booking.findFirst({
    where: {
      machineId,
      status: BookingStatus.CONFIRMED,
      startDate: { lte: endAt },
      endDate: { gte: startAt },
    },
    select: { id: true },
  });
  return Boolean(overlapping);
}

/** Best-effort calendar write and persistence of eventId. */
async function createCalendarForBooking(params: {
  bookingId: number;
  machineName: string;
  startYmd: string;
  endYmd: string;
  managerName?: string;
  customerName?: string;
  totalCost?: number;
}) {
  const {
    bookingId,
    machineName,
    startYmd,
    endYmd,
    managerName,
    customerName,
    totalCost,
  } = params;
  let eventId: string | null = null;

  try {
    const summary = `${machineName} • ${startYmd} → ${endYmd} (Ops)`;
    const description = [
      `Machine: ${machineName}`,
      `Dates: ${startYmd} → ${endYmd}`,
      managerName ? `Booked by (manager): ${managerName}` : undefined,
      customerName ? `Customer: ${customerName}` : "Customer: (not provided)",
      typeof totalCost === "number"
        ? `Total (declared): ${totalCost.toFixed(2)} EUR`
        : undefined,
      "Source: AMR /ops",
    ]
      .filter(Boolean)
      .join("\n");

    const created = (await createAllDayEvent({
      summary,
      description,
      startYmd,
      endYmd, // helper handles exclusive end internally
    })) as unknown;

    if (typeof created === "string") {
      eventId = created;
    } else if (created && typeof created === "object" && "id" in created) {
      eventId = (created as { id?: string | null }).id ?? null;
    }

    if (eventId) {
      await db.booking.update({
        where: { id: bookingId },
        data: { googleCalendarEventId: eventId },
      });
    }
  } catch (err) {
    console.error("Calendar write failed in /ops:", err);
    // Non-blocking by design.
  }

  return eventId;
}

// Action
export async function createManagerBooking(
  input: unknown
): Promise<ManagerBookingActionResult> {
  // 1) Validate without throwing; map Zod v4 error via z.flattenError()
  const parsed = ManagerBookingSchema.safeParse(input);
  if (!parsed.success) {
    const flattened = z.flattenError(parsed.error);
    const fieldErrors = flattened.fieldErrors ?? {};
    const formError =
      Array.isArray(flattened.formErrors) && flattened.formErrors.length
        ? flattened.formErrors.join(", ")
        : undefined;
    return { ok: false, fieldErrors, formError };
  }
  const data = parsed.data as Record<string, any>;

  // 2) Passcode check.
  if (
    !process.env.OPS_PASSCODE ||
    data.opsPasscode !== process.env.OPS_PASSCODE
  ) {
    return {
      ok: false,
      fieldErrors: { opsPasscode: ["Invalid passcode."] },
      formError: "Authentication failed for /ops.",
    };
  }

  // 3) Machine existence.
  const machine = await db.machine.findUnique({
    where: { id: Number(data.machineId) },
  });
  if (!machine) {
    return { ok: false, formError: "Selected machine not found." };
  }

  // 4) Normalize all-day dates and check for overlap against CONFIRMED.
  const startYmd: string = data.startDate; // "YYYY-MM-DD"
  const endYmd: string = data.endDate; // "YYYY-MM-DD"
  const startAt = ymdToUtcStart(startYmd);
  const endAt = ymdToUtcStart(endYmd);

  if (await hasConfirmedOverlap(machine.id, startAt, endAt)) {
    return { ok: false, formError: overlapMessage() };
  }

  // 5) Customer defaults to satisfy Prisma non-null columns
  const customer = buildCustomerDefaults(data);

  // 6) totalCost must still be provided (Decimal in Prisma). Keep a small guard.
  const totalCost =
    data.totalCost === undefined ||
    data.totalCost === null ||
    isNaN(Number(data.totalCost))
      ? null
      : Number(data.totalCost);
  if (totalCost === null) {
    return {
      ok: false,
      fieldErrors: { totalCost: ["Total cost is required."] },
    };
  }

  // 7) Create the booking. Keep add-ons off for ops per business rules.
  const booking = await db.booking.create({
    data: {
      machineId: machine.id,
      status: BookingStatus.CONFIRMED,
      startDate: startAt,
      endDate: endAt,

      insuranceSelected: false,
      deliverySelected: false,
      pickupSelected: false,
      operatorSelected: false,

      customerName: String(data.customerName),
      customerEmail: String(data.customerEmail),
      customerPhone: String(data.customerPhone),
      customerNIF: data.customerNIF ?? null,

      siteAddressLine1: data.siteAddressLine1 ?? null,
      siteAddressPostalCode: data.siteAddressPostalCode ?? null,
      siteAddressCity: data.siteAddressCity ?? null,
      siteAddressNotes: data.siteAddressNotes ?? null,

      // Optional billing fields omitted; they are nullable in the schema.

      totalCost: Number(data.totalCost),
      depositPaid: false,
      stripePaymentIntentId: null,
      googleCalendarEventId: null,
    },
    select: { id: true },
  });

  // 8) Best-effort Calendar write
  const eventId = await createCalendarForBooking({
    bookingId: booking.id,
    machineName: machine.name,
    startYmd,
    endYmd,
    managerName: data.managerName,
    customerName: customer.name,
    totalCost,
  });

  // 9) Return compact, serializable result for inline UX.
  return { ok: true, bookingId: booking.id, calendar: { eventId } };
}
