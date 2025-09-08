export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";

import { notifyBookingConfirmed } from "@/lib/notifications/notify-booking-confirmed";
import {
  formatLisbon,
  isOverlapError,
  leadTimeOverrideNoteIfAny,
} from "@/lib/ops/support";
import {
  createOpsBookingWithLock,
  tagBookingAsWaivedPI,
  findPendingHoldExpiry,
} from "@/lib/ops/repo";
import { parseOpsForm } from "@/lib/ops/parse";

export type OpsActionResult =
  | { ok: true; bookingId: string }
  | {
      ok: false;
      formError?: string;
      fieldErrors?: Record<string, string[]>;
      values?: Record<string, string>;
    };

/**
 * createOpsBookingAction
 * Orchestrates: parse → passcode guard → service create → tag waived → notify
 * Handles overlap errors with a friendly pending-hold message when possible.
 */
export async function createOpsBookingAction(
  _prev: unknown,
  formData: FormData
): Promise<OpsActionResult> {
  "use server";

  // 1) Parse & validate form (string inputs → typed DTO)
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

  // 3) Optional audit note for heavy-transport lead-time overrides
  const overrideNote = leadTimeOverrideNoteIfAny(data.machineId, data.start);

  try {
    // 4) Atomic create under advisory lock; DB constraint enforces no-overlap
    const created = await createOpsBookingWithLock({
      machineId: data.machineId,
      start: data.start,
      end: data.end,
      managerName: data.managerName,
      customerName: data.customerName,
      siteAddressLine1: data.siteAddressLine1,
      siteAddressCity: data.siteAddressCity ?? null,
      siteAddressNotes: data.siteAddressNotes ?? null,
      overrideNote,
    });

    // 5) Best-effort internal PI tag (non-blocking)
    tagBookingAsWaivedPI(created.id).catch(() => {});

    // 6) Fire-and-forget notifications (dry-run safe in shared adapter)
    notifyBookingConfirmed(created.id, "ops").catch((err) =>
      console.error("[ops:notify:error]", err)
    );

    return { ok: true, bookingId: String(created.id) };
  } catch (e: unknown) {
    // 7) Friendly overlap messaging if a PENDING hold is blocking
    if (isOverlapError(e)) {
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
        return {
          ok: false,
          formError:
            "Selected dates overlap an existing booking for this machine.",
          values: { ...raw, opsPasscode: "" },
        };
      } catch {
        // Fallback if the lookup itself fails
        return {
          ok: false,
          formError:
            "Selected dates overlap an existing booking for this machine.",
          values: { ...raw, opsPasscode: "" },
        };
      }
    }

    console.error("[ops:create:error]", e);
    return {
      ok: false,
      formError: "Unexpected server error. Please try again or contact admin.",
      values: { ...raw, opsPasscode: "" },
    };
  }
}
