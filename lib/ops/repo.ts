import "server-only";

/**
 * DB services for /ops workflow.
 * - Atomic create with per-machine advisory lock
 * - Optional "waived" PI tagging for internal tracking
 * - Lookup for a blocking PENDING hold's expiry (for better UX)
 */

type CreateOpsBookingInput = {
  machineId: number;
  start: Date;
  end: Date;

  // Minimal customer & site fields used by OPS
  managerName: string; // echoed as "OPS Booking" context
  customerName?: string;
  siteAddressLine1: string;
  siteAddressCity?: string | null;
  siteAddressNotes?: string | null;

  /** Optional audit note to append (e.g., heavy-transport override). */
  overrideNote?: string | null;
};

type OpsBookingCreated = { id: number };

/** Tiny helper: join two optional notes with a delimiter if both present. */
function combineNotes(a?: string | null, b?: string | null): string | null {
  const left = a?.trim() ?? "";
  const right = b?.trim() ?? "";
  if (left && right) return `${left} | ${right}`;
  if (left) return left;
  if (right) return right;
  return null;
}

/**
 * createOpsBookingWithLock
 * - Serializes writes by (namespace=1, key=machineId) using pg_advisory_xact_lock
 * - Relies on DB-level exclusion constraint to reject overlaps
 * - Keeps totalCost=0 and depositPaid=false for ops-created bookings
 */
export async function createOpsBookingWithLock(
  input: CreateOpsBookingInput
): Promise<OpsBookingCreated> {
  const { db } = await import("@/lib/db");

  const created = await db.$transaction(async (tx) => {
    // Per-machine serialization within the transaction
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${1}::int4, ${input.machineId}::int4)`;

    return tx.booking.create({
      data: {
        machineId: input.machineId,
        status: "CONFIRMED",
        startDate: input.start,
        endDate: input.end,

        // OPS defaults
        customerName: input.customerName || "OPS Booking",
        customerEmail: "ops@internal.local",
        customerPhone: "OPS",

        siteAddressLine1: input.siteAddressLine1,
        siteAddressCity: input.siteAddressCity ?? null,
        siteAddressNotes: combineNotes(input.siteAddressNotes, input.overrideNote),

        totalCost: 0,
        depositPaid: false,
        stripePaymentIntentId: null,
      },
      select: { id: true },
    });
  });

  return created;
}

/**
 * tagBookingAsWaivedPI
 * - Best-effort internal marker so ops-created bookings are visibly "waived".
 * - Non-throwing is handled by the caller if desired; here we bubble errors for clarity.
 */
export async function tagBookingAsWaivedPI(bookingId: number): Promise<void> {
  const { db } = await import("@/lib/db");
  await db.booking.update({
    where: { id: bookingId },
    data: { stripePaymentIntentId: `WAIVED_OPS_${bookingId}` },
  });
}

/**
 * findPendingHoldExpiry
 * - If an overlap stems from a PENDING hold, surface its expiry to the UI.
 * - Returns the expiry (Date) or null if not found.
 */
export async function findPendingHoldExpiry(
  machineId: number,
  start: Date,
  end: Date
): Promise<Date | null> {
  const { db } = await import("@/lib/db");
  const row = await db.booking.findFirst({
    where: {
      machineId,
      status: "PENDING",
      // Inclusive overlap: [start, end] intersects existing range
      startDate: { lte: end },
      endDate: { gte: start },
    },
    select: { holdExpiresAt: true },
  });
  return row?.holdExpiresAt ?? null;
}
