import { BookingStatus } from "@prisma/client";
import { startOfDay } from "date-fns";

import { db } from "@/lib/db";
import {
  computeDisabledRanges,
  type DisabledRangeJSON,
} from "@/lib/availability";

/**
 * getDisabledDateRangesForMachine
 * Returns a JSON-safe list of merged date ranges that must be disabled
 * in the calendar for a given machine.
 */

export async function getDisabledDateRangesForMachine(
  machineId: number
): Promise<DisabledRangeJSON[]> {
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
