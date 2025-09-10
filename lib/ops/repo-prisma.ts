import "server-only";

import type { BookingRepoPort } from "./booking-service";
import { ymdToUtcDate } from "@/lib/ops/support";
import { createOpsBookingWithLock, tagBookingAsWaivedPI } from "@/lib/ops/repo";
import { db } from "@/lib/db";

/** Small helper to join notes without duplicating logic elsewhere. */
function mergeNotes(
  base?: string | null,
  add1?: string | null,
  add2?: string | null
): string | null {
  const parts = [base, add1, add2]
    .map((s) => (s?.trim() ? s.trim() : ""))
    .filter(Boolean);
  return parts.length ? parts.join(" | ") : null;
}

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

    // 1) First try to PROMOTE an exact-match PENDING under the same per-machine lock.
    const promotedId = await db.$transaction(async (tx) => {
      // Serialize by machine so the probe + update are atomic.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${1}::int4, ${input.machineId}::int4)`;

      // Look for a PENDING with EXACT same [start,end] for this machine.
      const pending = await tx.booking.findFirst({
        where: {
          machineId: input.machineId,
          status: "PENDING",
          startDate: start,
          endDate: end,
        },
        select: {
          id: true,
          siteAddressLine1: true,
          siteAddressCity: true,
          siteAddressNotes: true,
        },
      });

      if (!pending) return null;

      // Only confirm + enrich notes; keep customer-provided site fields if present.
      const nextSiteLine1 = pending.siteAddressLine1 ?? input.siteAddressLine1;
      const nextSiteCity =
        pending.siteAddressCity ?? input.siteAddressCity ?? null;
      const nextNotes = mergeNotes(
        pending.siteAddressNotes,
        input.siteAddressNotes ?? null,
        input.overrideNote ?? null
      );

      const updated = await tx.booking.update({
        where: { id: pending.id },
        data: {
          status: "CONFIRMED",
          siteAddressLine1: nextSiteLine1,
          siteAddressCity: nextSiteCity,
          siteAddressNotes: nextNotes,
          // Do NOT overwrite totals or PI here; we tag waived PI separately.
        },
        select: { id: true },
      });

      return updated.id;
    });

    if (promotedId) {
      // Best-effort internal "waived" tag; non-blocking.
      tagBookingAsWaivedPI(promotedId).catch(() => {});
      return { bookingId: String(promotedId) };
    }

    // 2) No exact-match PENDING: fall back to the existing locked CREATE.
    //    If another ACTIVE overlap (PENDING/CONFIRMED) exists, the DB
    //    exclusion constraint will raise 23P01 and the service will return OVERLAP.
    const created = await createOpsBookingWithLock({
      machineId: input.machineId,
      start,
      end,
      managerName: input.managerName,
      customerName: input.customerName,
      siteAddressLine1: input.siteAddressLine1,
      siteAddressCity: input.siteAddressCity ?? null,
      siteAddressNotes: input.siteAddressNotes ?? null,
      overrideNote: input.overrideNote ?? null,
    });

    // Mark waived after successful create.
    tagBookingAsWaivedPI(created.id).catch(() => {});

    return { bookingId: String(created.id) };
  }
}

export function getPrismaBookingRepo(): BookingRepoPort {
  return new PrismaBookingRepo();
}

// Re-export for actions needing the friendly pending-hold copy.
export { findPendingHoldExpiry } from "@/lib/ops/repo";
