import "server-only";

import type { BookingRepoPort } from "./booking-service";
import { ymdToUtcDate } from "@/lib/ops/support";
import {
  createOpsBookingWithLock,
  findPendingHoldExpiry,
  tagBookingAsWaivedPI,
} from "@/lib/ops/repo";
import { db } from "@/lib/db";

export class PrismaBookingRepo implements BookingRepoPort {
  async hasConfirmedOverlap(input: {
    machineId: number;
    startYmd: string;
    endYmd: string;
  }): Promise<boolean> {
    const start = ymdToUtcDate(input.startYmd);
    const end = ymdToUtcDate(input.endYmd);

    const exists = await db.booking.findFirst({
      where: {
        machineId: input.machineId,
        status: "CONFIRMED",
        startDate: { lte: end },
        endDate: { gte: start },
      },
      select: { id: true },
    });

    return !!exists;
  }

  async createConfirmedOpsBooking(input: {
    machineId: number;
    startYmd: string;
    endYmd: string;
    managerName: string;
    customerName?: string;
    siteAddressLine1: string;
    siteAddressCity?: string;
    siteAddressNotes?: string;
    totalCostCents: number;
    depositCents: number;
    overrideNote?: string;
  }): Promise<{ bookingId: string }> {
    const start = ymdToUtcDate(input.startYmd);
    const end = ymdToUtcDate(input.endYmd);

    const created = await createOpsBookingWithLock({
      machineId: input.machineId,
      start,
      end,
      managerName: input.managerName,
      customerName: input.customerName,
      siteAddressLine1: input.siteAddressLine1,
      siteAddressCity: input.siteAddressCity ?? null,
      siteAddressNotes: input.siteAddressNotes ?? null,
      overrideNote: input.overrideNote ?? null, // ✅ forward audit note
    });

    // Best-effort waived marker; keep non-blocking for the service.
    tagBookingAsWaivedPI(created.id).catch(() => {});

    return { bookingId: String(created.id) };
  }
}

export function getPrismaBookingRepo(): BookingRepoPort {
  return new PrismaBookingRepo();
}

// Re-export for actions needing the friendly pending-hold copy.
export { findPendingHoldExpiry } from "@/lib/ops/repo";
