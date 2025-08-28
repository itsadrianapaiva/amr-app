//Bridge between database and availability logic
import { BookingStatus } from "@prisma/client";
import { startOfDay } from "date-fns";

import { db } from "@/lib/db";
import {
  computeDisabledRanges,
  type DisabledRangeJSON,
} from "@/lib/availability";

/**
 * getDisabledDateRangesForMachine
 * Fetch all relevant bookings for one specific machine and return a clean, JSON-safe array of date ranges that should be disabled in the calendar.
 */

export async function getDisabledDateRangesForMachine(
  machineId: number
): Promise<DisabledRangeJSON[]> {
  //DATABASE QUERY
  //Only care about bookings that haven't fully ended before today
  const today = startOfDay(new Date());

  const bookings = await db.booking.findMany({
    where: {
      machineId,
      status: BookingStatus.CONFIRMED,
      endDate: { gte: today },
    },
    select: {
      startDate: true,
      endDate: true,
    },
    orderBy: {
      startDate: "asc",
    },
  });

  const spans = bookings.map((b) => ({
    startDate: b.startDate,
    endDate: b.endDate,
  }));

  // Compute merged ranges and return the JSON-safe copy for RSC boundaries
  return computeDisabledRanges(spans).json;
}

/**
 * getDisabledRangesByMachine
 * Fetch CONFIRMED bookings that haven't ended and return a map:
 *    { [machineId]: DisabledRangeJSON[] }
 * for rendering blocked ranges per-machine (e.g., /ops date-range UI).
 */
export async function getDisabledRangesByMachine(): Promise<
  Record<number, DisabledRangeJSON[]>
> {
  const today = startOfDay(new Date());

  // Single roundtrip for all machines; pull minimal fields.
  const bookings = await db.booking.findMany({
    where: {
      status: BookingStatus.CONFIRMED,
      endDate: { gte: today },
    },
    select: {
      machineId: true,
      startDate: true,
      endDate: true,
    },
    orderBy: { startDate: "asc" },
  });

  // Group spans per machineId
  const grouped = new Map<number, Array<{ startDate: Date; endDate: Date }>>();
  for (const b of bookings) {
    const arr = grouped.get(b.machineId) ?? [];
    arr.push({ startDate: b.startDate, endDate: b.endDate });
    grouped.set(b.machineId, arr);
  }

  // Compute merged ranges for each machine and return JSON-safe structure
  const out: Record<number, DisabledRangeJSON[]> = {};
  for (const [machineId, spans] of grouped.entries()) {
    out[machineId] = computeDisabledRanges(spans).json;
  }
  return out;
}
