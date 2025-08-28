// app/ops/actions.ts
import {
  ManagerOpsSchema,
  type ManagerOpsInput,
} from "@/lib/validation/manager-booking";
import {
  createManagerBooking,
  type BookingRepoPort,
  type CreateManagerBookingInput,
} from "@/lib/ops/ops-booking-service";

export type OpsActionResult =
  | {
      ok: true;
      bookingId: string;
      calendar?: { eventId: string; htmlLink?: string };
      calendarError?: string;
    }
  | {
      ok: false;
      formError?: string;
      fieldErrors?: Record<string, string[]>;
      values?: Partial<ManagerOpsInput>;
    };

function fromFormData(fd: FormData): ManagerOpsInput {
  return {
    opsPasscode: String(fd.get("opsPasscode") ?? ""),
    machineId: Number(fd.get("machineId")),
    startYmd: String(fd.get("startYmd") ?? ""),
    endYmd: String(fd.get("endYmd") ?? ""),
    managerName: String(fd.get("managerName") ?? ""),
    customerName: String(fd.get("customerName") ?? ""),
    siteAddressLine1: String(fd.get("siteAddressLine1") ?? ""),
    siteAddressCity: String(fd.get("siteAddressCity") ?? ""),
    siteAddressNotes: String(fd.get("siteAddressNotes") ?? ""),
  };
}

function ymdToUtcDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export async function createOpsBookingAction(
  _prev: unknown,
  formData: FormData
): Promise<OpsActionResult> {
  "use server";

  const raw = fromFormData(formData);

  try {
    // 1) Parse + map errors (Zod v4: mapper fn)
    const parsed = ManagerOpsSchema.safeParse(raw);
    if (!parsed.success) {
      const formatted = parsed.error.format(
        (issue) => `Error: ${issue.message}`
      );
      const fieldErrors: Record<string, string[]> = {};
      for (const key of Object.keys(formatted)) {
        if (key === "_errors") continue;
        const entry: any = (formatted as any)[key];
        if (entry?._errors?.length)
          fieldErrors[key] = entry._errors as string[];
      }
      const formError = (formatted as any)._errors?.[0] as string | undefined;
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

    // 3) Lazy-load Node deps to keep Edge out of this module
    const [{ db }, { getMachineById }, calendarMod] = await Promise.all([
      import("@/lib/db"),
      import("@/lib/data"),
      import("@/lib/google-calendar"),
    ]);
    const { createAllDayEvent, hasCalendarOverlap } = calendarMod;

    // 4) Define the DB repo port inside the action (Prisma only exists here)
    const repo: BookingRepoPort = {
      async hasConfirmedOverlap({ machineId, startYmd, endYmd }) {
        const start = ymdToUtcDate(startYmd);
        const end = ymdToUtcDate(endYmd);
        const hit = await db.booking.findFirst({
          where: {
            machineId,
            status: "CONFIRMED",
            NOT: {
              OR: [{ endDate: { lt: start } }, { startDate: { gt: end } }],
            },
          },
          select: { id: true },
        });
        return Boolean(hit);
      },
      async createConfirmedOpsBooking(i) {
        const booking = await db.booking.create({
          data: {
            machineId: i.machineId,
            status: "CONFIRMED",
            startDate: ymdToUtcDate(i.startYmd),
            endDate: ymdToUtcDate(i.endYmd),

            // Required fields for ops path (no checkout)
            customerName: i.customerName ?? "OPS Booking",
            customerEmail: "ops@internal.local",
            customerPhone: "OPS",

            // Optional site details
            siteAddressLine1: i.siteAddressLine1,
            siteAddressCity: i.siteAddressCity ?? null,
            siteAddressNotes: i.siteAddressNotes ?? null,

            // Ops are always waived
            totalCost: 0,
            depositPaid: false,
            stripePaymentIntentId: null, // set after create with a waived id
          },
          select: { id: true },
        });
        return { bookingId: String(booking.id) };
      },
    };

    // 5) Domain service (overlap + create confirmed, zero totals)
    const { opsPasscode, ...rest } = input;
    const result = await createManagerBooking(
      rest as CreateManagerBookingInput,
      { repo }
    );
    if (!result.ok) {
      return {
        ok: false,
        formError:
          result.reason === "OVERLAP"
            ? "Selected dates overlap an existing booking."
            : "Unable to create booking.",
        values: { ...input, opsPasscode: "" },
      };
    }

    // 6) Best-effort calendar write
    let eventId: string | null = null;
    let htmlLink: string | undefined;
    let calendarError: string | undefined;
    try {
      const busy = await hasCalendarOverlap({
        startYmd: input.startYmd,
        endYmd: input.endYmd,
      });
      if (!busy) {
        const machine = await getMachineById(input.machineId);
        const summary = `Machine: ${
          machine?.name ?? `#${input.machineId}`
        } — Manager: ${input.managerName}`;
        const locationLine = [input.siteAddressLine1, input.siteAddressCity]
          .filter(Boolean)
          .join(", ");
        const description = [
          `Booking ID: ${result.bookingId}`,
          `Location: ${locationLine}`,
          input.customerName ? `Customer: ${input.customerName}` : null,
          input.siteAddressNotes ? `Notes: ${input.siteAddressNotes}` : null,
          "Source: /ops",
        ]
          .filter(Boolean)
          .join("\n");
        const cal = await createAllDayEvent({
          startYmd: input.startYmd,
          endYmd: input.endYmd,
          summary,
          description,
        });
        eventId = cal.id;
        htmlLink = cal.htmlLink ?? undefined;
      } else {
        calendarError = "Google Calendar reports this period as busy.";
      }
    } catch (e: any) {
      calendarError = e?.message || "Calendar write failed.";
    }

    // 7) Persist calendar id and a unique waived PaymentIntent id
    try {
      await (
        await import("@/lib/db")
      ).db.booking.update({
        where: { id: Number(result.bookingId) },
        data: {
          googleCalendarEventId: eventId ?? null,
          stripePaymentIntentId: `WAIVED_OPS_${result.bookingId}`,
        },
      });
    } catch {
      // Non-fatal
    }

    return {
      ok: true,
      bookingId: result.bookingId,
      calendar: eventId ? { eventId, htmlLink } : undefined,
      calendarError,
    };
  } catch (e: any) {
    console.error("OPS action failed:", e);
    return {
      ok: false,
      formError: "Unexpected server error. Please try again or contact admin.",
      values: { ...raw, opsPasscode: "" },
    };
  }
}
