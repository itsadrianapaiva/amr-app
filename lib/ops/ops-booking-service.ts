import type { ManagerOpsInput } from "@/lib/validation/manager-booking";

/** Inputs the action passes in after schema validation. */
export type CreateManagerBookingInput = Omit<ManagerOpsInput, "opsPasscode">;

/** Repository port: DB-only concerns live behind this interface. */
export interface BookingRepoPort {
  hasConfirmedOverlap(input: {
    machineId: number;
    startYmd: string; // inclusive YYYY-MM-DD
    endYmd: string; // inclusive YYYY-MM-DD
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
    depositCents: number; // always 0 for ops
  }): Promise<{ bookingId: string }>;
}

/** Small result union keeps the action simple. */
export type CreateManagerBookingResult =
  | { ok: true; bookingId: string }
  | { ok: false; reason: "OVERLAP" | "UNKNOWN"; message: string };

/** Safe numeric compare of YYYY-MM-DD without allocating Date objects. */
function ymdToNumber(ymd: string): number {
  // yyyymmdd as integer
  return Number(ymd.replaceAll("-", ""));
}

/**
 * createManagerBooking
 * Pure orchestration: enforce invariants, consult repo ports, create booking.
 * No calendar or Stripe here. Those are handled by the action layer.
 */
export async function createManagerBooking(
  input: CreateManagerBookingInput,
  deps: { repo: BookingRepoPort }
): Promise<CreateManagerBookingResult> {
  const { repo } = deps;

  // Minimal sanity check (schema already validated).
  if (ymdToNumber(input.startYmd) >= ymdToNumber(input.endYmd)) {
    return {
      ok: false,
      reason: "UNKNOWN",
      message: "Start must be before end",
    };
  }

  // Domain rule: do not allow overlap with confirmed bookings.
  const overlap = await repo.hasConfirmedOverlap({
    machineId: input.machineId,
    startYmd: input.startYmd,
    endYmd: input.endYmd,
  });
  if (overlap) {
    return {
      ok: false,
      reason: "OVERLAP",
      message: "Selected dates overlap an existing booking",
    };
  }

  // Ops bookings are always waived.
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
  });

  return { ok: true, bookingId };
}
