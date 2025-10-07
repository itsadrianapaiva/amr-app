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
  customerName: string;
  siteAddressLine1: string | null;
  siteAddressCity: string | null;
  siteAddressPostalCode: string | null;
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
 * grouped by machine, with dates normalized to Lisbon and minimal customer/site context.
 *
 * Overlap condition:
 *   startDate <= to  AND  endDate >= from
 */
export async function getAvailabilityWindow(
  params: AvailabilityParams
): Promise<AvailabilityWindow> {
  const { from, to } = params;
  if (from > to) throw new Error("getAvailabilityWindow: 'from' must be <= 'to'.");

  const rows = await db.booking.findMany({
    where: {
      status: BookingStatus.CONFIRMED,
      startDate: { lte: to },
      endDate: { gte: from },
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      customerName: true,
      siteAddressLine1: true,
      siteAddressCity: true,
      siteAddressPostalCode: true,
      machine: { select: { id: true, name: true } },
    },
    orderBy: [{ machineId: "asc" }, { startDate: "asc" }],
  });

  const byMachine = new Map<number, AvailabilityByMachine>();

  for (const r of rows) {
    const mId = r.machine.id;
    if (!byMachine.has(mId)) {
      byMachine.set(mId, {
        machineId: mId,
        machineName: r.machine.name,
        bookings: [],
      });
    }
    byMachine.get(mId)!.bookings.push({
      id: r.id,
      startYmd: ymdLisbon(new Date(r.startDate)),
      endYmd: ymdLisbon(new Date(r.endDate)),
      customerName: r.customerName,
      siteAddressLine1: r.siteAddressLine1,
      siteAddressCity: r.siteAddressCity,
      siteAddressPostalCode: r.siteAddressPostalCode,
    });
  }

  return {
    fromYmd: ymdLisbon(from),
    toYmd: ymdLisbon(to),
    machines: Array.from(byMachine.values()),
  };
}
