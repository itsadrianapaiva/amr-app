// lib/ops/booking-service.ts
import type { ManagerOpsInput } from "@/lib/validation/manager-booking";

/** Inputs the action passes in after schema validation (no passcode here). */
export type CreateManagerBookingInput = Omit<ManagerOpsInput, "opsPasscode"> & {
  /** Optional audit note (e.g., heavy-transport lead-time override). */
  overrideNote?: string;
};

/** Repository port: DB-only concerns live behind this interface. */
export interface BookingRepoPort {
  hasConfirmedOverlap(input: {
    machineId: number;
    startYmd: string; // inclusive YYYY-MM-DD
    endYmd: string;   // inclusive YYYY-MM-DD
  }): Promise<boolean>;

  createConfirmedOpsBooking(input: {
    machineId: number;
    startYmd: string;
    endYmd: string;
    managerName: string;
    customerName?: string;
    siteAddressLine1: string;
    siteAddressCity?: string;
    siteAddressNotes?: string;
    totalCostCents: number; // always 0 for ops
    depositCents: number;   // always 0 for ops
    /** Optional audit note (stored alongside site notes). */
    overrideNote?: string;
  }): Promise<{ bookingId: string }>;
}

/** Small result union keeps the action simple. */
export type CreateManagerBookingResult =
  | { ok: true; bookingId: string }
  | { ok: false; reason: "OVERLAP" | "UNKNOWN"; message: string };

/** Safe numeric compare of YYYY-MM-DD without allocating Date objects. */
function ymdToNumber(ymd: string): number {
  // e.g., "2025-09-08" -> 20250908
  return Number(ymd.replaceAll("-", ""));
}

/**
 * createManagerBooking
 * Pure orchestration: enforce invariants, consult repo port, create booking.
 * NOTE: `hasConfirmedOverlap` is a UX precheck; repo must still enforce atomic no-overlap.
 */
export async function createManagerBooking(
  input: CreateManagerBookingInput,
  deps: { repo: BookingRepoPort }
): Promise<CreateManagerBookingResult> {
  const { repo } = deps;

  // 1) Minimal invariant — allow same-day rentals (start <= end).
  if (ymdToNumber(input.startYmd) > ymdToNumber(input.endYmd)) {
    return {
      ok: false,
      reason: "UNKNOWN",
      message: "Start date must be on or before end date.",
    };
  }

  // 2) Domain rule: do not allow overlap with CONFIRMED bookings.
  const overlap = await repo.hasConfirmedOverlap({
    machineId: input.machineId,
    startYmd: input.startYmd,
    endYmd: input.endYmd,
  });
  if (overlap) {
    return {
      ok: false,
      reason: "OVERLAP",
      message: "Selected dates overlap an existing booking.",
    };
  }

  // 3) Create as CONFIRMED, waived (0 totals) — repo handles atomicity.
  const { bookingId } = await repo.createConfirmedOpsBooking({
    machineId: input.machineId,
    startYmd: input.startYmd,
    endYmd: input.endYmd,
    managerName: input.managerName,
    customerName: input.customerName,
    siteAddressLine1: input.siteAddressLine1,
    siteAddressCity: input.siteAddressCity,
    siteAddressNotes: input.siteAddressNotes,
    totalCostCents: 0,
    depositCents: 0,
    overrideNote: input.overrideNote, 
  });

  return { ok: true, bookingId };
}
