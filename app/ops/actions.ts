// app/ops/actions.ts
"use server";

import { notifyBookingConfirmed } from "@/lib/notifications/notify-booking-confirmed";
import { formatLisbon, leadTimeOverrideNoteIfAny } from "@/lib/ops/support";
import { parseOpsForm } from "@/lib/ops/parse";
import {
  createManagerBooking,
  type CreateManagerBookingInput,
} from "@/lib/ops/booking-service";
import {
  getPrismaBookingRepo,
  findPendingHoldExpiry,
} from "@/lib/ops/repo-prisma";

export type OpsActionResult =
  | { ok: true; bookingId: string }
  | {
      ok: false;
      formError?: string;
      fieldErrors?: Record<string, string[]>;
      values?: Record<string, string>;
    };

/**
 * Server Action used by the Ops create booking form.
 * Note:
 * - Module-level `"use server"` marks this whole file as server-only (safe to import the function in a Client Component).
 * - We removed `import "server-only"` (that broke client import).
 * - Keep the `(prev, formData)` signature for Server Actions.
 */
export async function createOpsBookingAction(
  _prev: unknown,
  formData: FormData
): Promise<OpsActionResult> {
  // 1) Parse & validate
  const parsed = await parseOpsForm(formData);
  if (!parsed.ok) {
    return {
      ok: false,
      formError: parsed.formError,
      fieldErrors: parsed.fieldErrors,
      values: parsed.values,
    };
  }

  const { data, raw } = parsed;

  // 2) Passcode guard
  if (data.opsPasscode !== process.env.OPS_PASSCODE) {
    return {
      ok: false,
      formError: "Invalid passcode.",
      values: { ...raw, opsPasscode: "" },
    };
  }

  // 3) Compute optional heavy-transport override audit note
  const overrideNoteMaybe = leadTimeOverrideNoteIfAny(
    data.machineId,
    data.start
  );

  // 4) Service call via Prisma adapter
  const repo = getPrismaBookingRepo();
  const svcInput: CreateManagerBookingInput = {
    machineId: data.machineId,
    startYmd: raw.startYmd,
    endYmd: raw.endYmd,
    managerName: data.managerName,
    customerName: data.customerName ?? undefined,
    siteAddressLine1: data.siteAddressLine1,
    siteAddressCity: data.siteAddressCity ?? undefined,
    siteAddressNotes: data.siteAddressNotes ?? undefined,
    overrideNote: overrideNoteMaybe ?? undefined, // coerce null → undefined
  };

  const result = await createManagerBooking(svcInput, { repo });

  if (result.ok) {
    const bookingId = result.bookingId;

    // Fire-and-forget notifications
    notifyBookingConfirmed(Number(bookingId), "ops").catch((err) =>
      console.error("[ops:notify:error]", err)
    );

    return { ok: true, bookingId };
  }

  // Friendly overlap message (pending hold)
  if (result.reason === "OVERLAP") {
    try {
      const holdExpiry = await findPendingHoldExpiry(
        data.machineId,
        data.start,
        data.end
      );
      if (holdExpiry) {
        const when = formatLisbon(holdExpiry);
        return {
          ok: false,
          formError:
            `These dates are currently held by a customer until ${when} (Lisbon). ` +
            `Choose different dates or try again later.`,
          values: { ...raw, opsPasscode: "" },
        };
      }
    } catch {
      // ignore lookup error and fall back
    }

    return {
      ok: false,
      formError: "Selected dates overlap an existing booking for this machine.",
      values: { ...raw, opsPasscode: "" },
    };
  }

  // Unknown error
  return {
    ok: false,
    formError:
      result.message ||
      "Unexpected server error. Please try again or contact admin.",
    values: { ...raw, opsPasscode: "" },
  };
}
