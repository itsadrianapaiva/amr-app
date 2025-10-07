import "server-only";
import { db } from "@/lib/db";
import { BookingStatus } from "@prisma/client";

/** Lisbon-safe YYYY-MM-DD formatter to avoid off-by-one UI issues. */
function ymdLisbon(date: Date): string {
  const [dd, mm, yyyy] = date
    .toLocaleDateString("en-GB", {
      timeZone: "Europe/Lisbon",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .split("/");
  return `${yyyy}-${mm}-${dd}`;
}

export type AvailabilityParams = {
  from: Date; // inclusive
  to: Date;   // inclusive
};

export type AvailabilityBooking = {
  id: number;
  startYmd: string; // normalized to Lisbon
  endYmd: string;   // normalized to Lisbon
};

export type AvailabilityByMachine = {
  machineId: number;
  machineName: string;
  bookings: AvailabilityBooking[];
};

export type AvailabilityWindow = {
  fromYmd: string;
  toYmd: string;
  machines: AvailabilityByMachine[];
};

/**
 * Returns machines that have at least one CONFIRMED booking overlapping the window,
 * grouped by machine, with dates normalized to Lisbon.
 *
 * Overlap condition:
 *   startDate <= to  AND  endDate >= from
 */
export async function getAvailabilityWindow(
  params: AvailabilityParams
): Promise<AvailabilityWindow> {
  const { from, to } = params;

  if (from > to) {
    throw new Error("getAvailabilityWindow: 'from' must be <= 'to'.");
  }

  const bookings = await db.booking.findMany({
    where: {
      status: BookingStatus.CONFIRMED,
      startDate: { lte: to },
      endDate: { gte: from },
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      machine: { select: { id: true, name: true } },
    },
    orderBy: [{ machineId: "asc" }, { startDate: "asc" }],
  });

  const byMachine = new Map<number, AvailabilityByMachine>();

  for (const b of bookings) {
    const mId = b.machine.id;
    if (!byMachine.has(mId)) {
      byMachine.set(mId, {
        machineId: mId,
        machineName: b.machine.name,
        bookings: [],
      });
    }
    byMachine.get(mId)!.bookings.push({
      id: b.id,
      startYmd: ymdLisbon(new Date(b.startDate)),
      endYmd: ymdLisbon(new Date(b.endDate)),
    });
  }

  return {
    fromYmd: ymdLisbon(from),
    toYmd: ymdLisbon(to),
    machines: Array.from(byMachine.values()),
  };
}
