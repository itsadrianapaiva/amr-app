export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { ManagerOpsSchema } from "@/lib/validation/manager-booking";
import { notifyBookingConfirmed } from "@/lib/notifications/notify-booking-confirmed";
import { validateLeadTimeLisbon } from "@/lib/logistics/lead-time";

// Heavy-transport config (MVP: machine IDs 5,6,7; 2 days; 15:00 cutoff)
const HEAVY_MACHINE_IDS = new Set<number>([5, 6, 7]);
const LEAD_DAYS = 2;
const CUTOFF_HOUR = 15;

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

  const isOverlapError = (e: unknown): boolean => {
    const msg = e instanceof Error ? e.message : String(e);
    return (
      msg.includes("booking_no_overlap_for_active") ||
      msg.toLowerCase().includes("exclusion") ||
      msg.toLowerCase().includes("overlap")
    );
  };

  // Format a Date in Lisbon time as "DD Mon, HH:MM"
  const formatLisbon = (d: Date) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Lisbon",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);

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
    // 1) Validate input
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

    // 2) Passcode guard
    if (input.opsPasscode !== process.env.OPS_PASSCODE) {
      return {
        ok: false,
        formError: "Invalid passcode.",
        values: { ...raw, opsPasscode: "" },
      };
    }

    // 3) Lazy-load DB
    const { db } = await import("@/lib/db");

    // 4) Normalize ids and dates
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

    // 4.1) Lead-time override audit (no blocking). If heavy & too soon, append an override note.
    let overrideNote: string | null = null;
    if (HEAVY_MACHINE_IDS.has(machineIdNum)) {
      const { ok, earliestAllowedDay } = validateLeadTimeLisbon({
        startDate: start,
        leadDays: LEAD_DAYS,
        cutoffHour: CUTOFF_HOUR,
      });
      if (!ok) {
        const friendly = earliestAllowedDay.toLocaleDateString("en-GB", {
          timeZone: "Europe/Lisbon",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
        const stamp = new Date().toLocaleString("en-GB", {
          timeZone: "Europe/Lisbon",
        });
        overrideNote = `[OPS OVERRIDE] Heavy-transport lead time bypassed on ${stamp}. Earliest allowed was ${friendly}.`;
      }
    }

    // 5) Atomic create with per-machine advisory lock; DB constraint enforces no-overlap
    const created = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${1}::int4, ${machineIdNum}::int4)`;

      return await tx.booking.create({
        data: {
          machineId: machineIdNum,
          status: "CONFIRMED",
          startDate: start,
          endDate: end,

          // OPS defaults
          customerName: input.customerName || "OPS Booking",
          customerEmail: "ops@internal.local",
          customerPhone: "OPS",

          siteAddressLine1: input.siteAddressLine1,
          siteAddressCity: input.siteAddressCity || null,
          siteAddressNotes: overrideNote
            ? [input.siteAddressNotes || "", overrideNote]
                .filter(Boolean)
                .join(" | ")
            : input.siteAddressNotes || null,

          totalCost: 0,
          depositPaid: false,
          googleCalendarEventId: null,
          stripePaymentIntentId: null,
        },
        select: { id: true },
      });
    });

    // Optional: best-effort tag payment intent for internal tracking
    try {
      const { db } = await import("@/lib/db");
      await db.booking.update({
        where: { id: created.id },
        data: { stripePaymentIntentId: `WAIVED_OPS_${created.id}` },
      });
    } catch {}

    //fire-and-forget notifications. Do not block the success path.
    // Uses the shared notifier which is already dry-run safe.
    notifyBookingConfirmed(created.id, "ops").catch((err) =>
      console.error("[ops:notify:error]", err)
    );

    return { ok: true, bookingId: String(created.id) };
  } catch (e: any) {
    // 6) Better messaging for overlaps: if a PENDING hold is blocking, show its expiry (if present)
    if (isOverlapError(e)) {
      try {
        const { db } = await import("@/lib/db");

        const pendingHold = await db.booking.findFirst({
          where: {
            machineId: Number(raw.machineId),
            status: "PENDING",
            // Inclusive overlap: [start, end] intersects existing range
            startDate: { lte: ymdToUtcDate(raw.endYmd) },
            endDate: { gte: ymdToUtcDate(raw.startYmd) },
          },
          select: { holdExpiresAt: true },
        });

        if (pendingHold?.holdExpiresAt) {
          const when = formatLisbon(pendingHold.holdExpiresAt);
          return {
            ok: false,
            formError:
              `These dates are currently held by a customer until ${when} (Lisbon). ` +
              `Choose different dates or try again later.`,
            values: { ...raw, opsPasscode: "" },
          };
        }

        // If no pending hold found (or no expiry), fall back to generic overlap
        return {
          ok: false,
          formError:
            "Selected dates overlap an existing booking for this machine.",
          values: { ...raw, opsPasscode: "" },
        };
      } catch {
        // If the lookup itself fails, still return a safe generic message
        return {
          ok: false,
          formError:
            "Selected dates overlap an existing booking for this machine.",
          values: { ...raw, opsPasscode: "" },
        };
      }
    }

    console.error("OPS action failed:", e);
    return {
      ok: false,
      formError: "Unexpected server error. Please try again or contact admin.",
      values: { ...raw, opsPasscode: "" },
    };
  }
}
