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
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

// Tiny structured logger to make server-action flow visible in logs
function log(step: string, detail?: Record<string, unknown>) {
  // Avoid logging secrets; keep it high-level
  console.info("[ops:action]", step, detail ?? {});
}

export type OpsActionResult =
  | { ok: true; bookingId: string }
  | {
      ok: false;
      formError?: string;
      fieldErrors?: Record<string, string[]>;
      values?: Record<string, string>;
    };

export async function createOpsBookingAction(
  _prev: unknown,
  formData: FormData
): Promise<OpsActionResult> {
  log("parse:start");
  const parsed = await parseOpsForm(formData);
  if (!parsed.ok) {
    log("parse:fail", {
      formError: parsed.formError,
      fieldErrors: !!parsed.fieldErrors,
    });
    return {
      ok: false,
      formError: parsed.formError,
      fieldErrors: parsed.fieldErrors,
      values: parsed.values,
    };
  }
  const { data, raw } = parsed;
  log("parse:ok", {
    machineId: data.machineId,
    startYmd: raw.startYmd,
    endYmd: raw.endYmd,
  });

  // Passcode guard
  const passcodeOk = data.opsPasscode === process.env.OPS_PASSCODE;
  log("passcode:check", { ok: passcodeOk });
  if (!passcodeOk) {
    return {
      ok: false,
      formError: "Invalid passcode.",
      values: { ...raw, opsPasscode: "" },
    };
  }

  // Optional heavy-transport override audit note
  const overrideNoteMaybe = leadTimeOverrideNoteIfAny(
    data.machineId,
    data.start
  );
  if (overrideNoteMaybe) log("override:note", { override: true });

  // Service call via Prisma adapter
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
    overrideNote: overrideNoteMaybe ?? undefined,
  };

  log("service:call", {
    machineId: svcInput.machineId,
    startYmd: svcInput.startYmd,
    endYmd: svcInput.endYmd,
  });

  const result = await createManagerBooking(svcInput, { repo });

  if (result.ok) {
    const bookingId = result.bookingId;

    // Make sure any server-rendered data used by /ops is fresh on next view
    // If your availability is tagged (e.g., revalidateTag("availability:9")),
    // we can switch to tag revalidation once you share that file.
    revalidatePath("/ops");

    notifyBookingConfirmed(Number(bookingId), "ops").catch((err) =>
      console.error("[ops:notify:error]", err)
    );

    redirect(`/ops/success?bookingId=${encodeURIComponent(bookingId)}`);
  }

  // Friendly overlap message (pending hold)
  if (result.reason === "OVERLAP") {
    log("overlap:detected");
    try {
      const holdExpiry = await findPendingHoldExpiry(
        data.machineId,
        data.start,
        data.end
      );
      if (holdExpiry) {
        const when = formatLisbon(holdExpiry);
        log("overlap:hold_expiry", { when });
        return {
          ok: false,
          formError:
            `These dates are currently held by a customer until ${when} (Lisbon). ` +
            `Choose different dates or try again later.`,
          values: { ...raw, opsPasscode: "" },
        };
      }
    } catch (e) {
      log("overlap:expiry_lookup_error", { message: (e as Error).message });
    }

    return {
      ok: false,
      formError: "Selected dates overlap an existing booking for this machine.",
      values: { ...raw, opsPasscode: "" },
    };
  }

  log("service:fail", { reason: result.reason ?? "unknown" });
  return {
    ok: false,
    formError:
      result.message ||
      "Unexpected server error. Please try again or contact admin.",
    values: { ...raw, opsPasscode: "" },
  };
}
