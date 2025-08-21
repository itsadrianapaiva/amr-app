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
