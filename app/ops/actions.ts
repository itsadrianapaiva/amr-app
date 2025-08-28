export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { ManagerOpsSchema } from "@/lib/validation/manager-booking";
import { revalidatePath } from "next/cache";

export type OpsActionResult =
  | {
      ok: true;
      bookingId: string;
    }
  | {
      ok: false;
      formError?: string;
      fieldErrors?: Record<string, string[]>;
      values?: Record<string, string>;
    };

// tiny pure helpers

/** Convert YYYY-MM-DD to a UTC Date (00:00Z) for consistent comparisons. */
function ymdToUtcDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Map Zod formatted error to { fieldErrors, formError }. */
function mapZodErrors(formatted: Record<string, any>) {
  const fieldErrors: Record<string, string[]> = {};
  for (const key of Object.keys(formatted)) {
    if (key === "_errors") continue;
    const entry = (formatted as any)[key];
    if (entry?._errors?.length) fieldErrors[key] = entry._errors as string[];
  }
  const formError = (formatted as any)?._errors?.[0] as string | undefined;
  return { fieldErrors, formError };
}

// server action

export async function createOpsBookingAction(
  _prev: unknown,
  formData: FormData
): Promise<OpsActionResult> {
  "use server";

  // Keep raw strings so we can echo them back safely on errors
  const raw: Record<string, string> = {
    opsPasscode: String(formData.get("opsPasscode") ?? ""),
    machineId: String(formData.get("machineId") ?? ""),
    startYmd: String(formData.get("startYmd") ?? ""),
    endYmd: String(formData.get("endYmd") ?? ""),
    managerName: String(formData.get("managerName") ?? ""),
    customerName: String(formData.get("customerName") ?? ""),
    siteAddressLine1: String(formData.get("siteAddressLine1") ?? ""),
    siteAddressCity: String(formData.get("siteAddressCity") ?? ""),
    siteAddressNotes: String(formData.get("siteAddressNotes") ?? ""),
  };

  try {
    // 1) Validate input (structured errors, no throws)
    const parsed = ManagerOpsSchema.safeParse(raw);
    if (!parsed.success) {
      const formatted = parsed.error.format(
        (issue) => `Error: ${issue.message}`
      );
      const { fieldErrors, formError } = mapZodErrors(formatted);
      return {
        ok: false,
        fieldErrors,
        formError,
        values: { ...raw, opsPasscode: "" },
      };
    }
    const input = parsed.data;

    // 2) Passcode guard (fail fast)
    if (input.opsPasscode !== process.env.OPS_PASSCODE) {
      return {
        ok: false,
        formError: "Invalid passcode.",
        values: { ...raw, opsPasscode: "" },
      };
    }

    // 3) Lazy-load DB only after guards pass
    const { db } = await import("@/lib/db");

    // 4) Normalize types for DB (ids are numeric in Prisma)
    const machineIdNum = Number(input.machineId);
    if (!Number.isInteger(machineIdNum) || machineIdNum <= 0) {
      return {
        ok: false,
        formError: "Invalid machine id.",
        values: { ...raw, opsPasscode: "" },
      };
    }

    const start = ymdToUtcDate(input.startYmd);
    const end = ymdToUtcDate(input.endYmd);

    // 5) Overlap check (machine-scoped, inclusive)
    const overlap = await db.booking.findFirst({
      where: {
        machineId: machineIdNum,
        status: "CONFIRMED",
        NOT: { OR: [{ endDate: { lt: start } }, { startDate: { gt: end } }] },
      },
      select: { id: true },
    });
    if (overlap) {
      return {
        ok: false,
        formError:
          "Selected dates overlap an existing booking for this machine.",
        values: { ...raw, opsPasscode: "" },
      };
    }

    // 6) DB-FIRST: create the CONFIRMED booking; Calendar is a separate action
    const created = await db.booking.create({
      data: {
        machineId: machineIdNum,
        status: "CONFIRMED",
        startDate: start,
        endDate: end,

        // OPS path defaults
        customerName: input.customerName || "OPS Booking",
        customerEmail: "ops@internal.local",
        customerPhone: "OPS",

        siteAddressLine1: input.siteAddressLine1,
        siteAddressCity: input.siteAddressCity || null,
        siteAddressNotes: input.siteAddressNotes || null,

        totalCost: 0,
        depositPaid: false,

        googleCalendarEventId: null, // set by dedicated calendar action later
        // IMPORTANT: keep null on create to avoid unique constraint collisions
        stripePaymentIntentId: null,
      },
      select: { id: true },
    });

    // 7) Best-effort finalize a unique waived PI id (non-fatal)
    try {
      await db.booking.update({
        where: { id: created.id },
        data: { stripePaymentIntentId: `WAIVED_OPS_${created.id}` },
      });
    } catch {
      // ignore; not critical to ops flow
    }

    // 8) Revalidate the ops page so the next submit sees a fresh tree
    try {
      revalidatePath("/ops");
    } catch {
      // revalidate is best-effort; never fail the action
    }

    return { ok: true, bookingId: String(created.id) };
  } catch (e: any) {
    console.error("OPS action failed:", e);
    return {
      ok: false,
      formError: "Unexpected server error. Please try again or contact admin.",
      values: { ...raw, opsPasscode: "" },
    };
  }
}
