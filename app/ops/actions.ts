"use server";

import {
  ManagerOpsSchema,
  type ManagerOpsInput,
} from "@/lib/validation/manager-booking";
import {
  createManagerBooking,
  type BookingRepoPort,
  type CreateManagerBookingInput,
} from "@/lib/ops/ops-booking-service";
import { createAllDayEvent, hasCalendarOverlap } from "@/lib/google-calendar";
import { getMachineById } from "@/lib/data";
import { db } from "@/lib/db";

export type OpsActionResult =
  | {
      ok: true;
      bookingId: string;
      calendar?: { eventId: string; htmlLink?: string };
    }
  | {
      ok: false;
      formError?: string;
      fieldErrors?: Record<string, string[]>;
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

/** DB adapter using your Booking model with DateTime fields. */
const repo: BookingRepoPort = {
  async hasConfirmedOverlap({ machineId, startYmd, endYmd }) {
    const start = ymdToUtcDate(startYmd);
    const end = ymdToUtcDate(endYmd);
    // Overlap for inclusive ranges: NOT (existing.end < start || existing.start > end)
    const hit = await db.booking.findFirst({
      where: {
        machineId,
        status: "CONFIRMED",
        NOT: { OR: [{ endDate: { lt: start } }, { startDate: { gt: end } }] },
      },
      select: { id: true },
    });
    return Boolean(hit);
  },

  async createConfirmedOpsBooking(input) {
    const booking = await db.booking.create({
      data: {
        machineId: input.machineId,
        status: "CONFIRMED",
        startDate: ymdToUtcDate(input.startYmd),
        endDate: ymdToUtcDate(input.endYmd),

        // Required customer fields for ops path (no checkout here)
        customerName: input.customerName ?? "OPS Booking",
        customerEmail: "ops@internal.local",
        customerPhone: "OPS",

        // Optional site details
        siteAddressLine1: input.siteAddressLine1,
        siteAddressCity: input.siteAddressCity ?? null,
        siteAddressNotes: input.siteAddressNotes ?? null,

        // Ops are always waived
        totalCost: 0,
        depositPaid: false,
        stripePaymentIntentId: null,
      },
      select: { id: true },
    });
    return { bookingId: String(booking.id) };
  },
};

export async function createOpsBookingAction(
  _prev: unknown,
  formData: FormData
): Promise<OpsActionResult> {
  // 1) Parse + format Zod errors using mapper fn (latest Zod)
  const parsed = ManagerOpsSchema.safeParse(fromFormData(formData));
  if (!parsed.success) {
    const formatted = parsed.error.format((issue) => `Error: ${issue.message}`);
    const fieldErrors: Record<string, string[]> = {};
    for (const key of Object.keys(formatted)) {
      if (key === "_errors") continue;
      const entry: any = (formatted as any)[key];
      if (entry?._errors?.length) fieldErrors[key] = entry._errors as string[];
    }
    const formError = (formatted as any)._errors?.[0] as string | undefined;
    return { ok: false, fieldErrors, formError };
  }
  const input = parsed.data;

  // 2) Passcode guard
  if (input.opsPasscode !== process.env.OPS_PASSCODE) {
    return { ok: false, formError: "Invalid passcode." };
  }

  // 3) Domain service: overlap check + create confirmed booking (zero totals)
  const { opsPasscode, ...rest } = input;
  const svcInput = rest as CreateManagerBookingInput;
  const result = await createManagerBooking(svcInput, { repo });
  if (!result.ok) {
    return {
      ok: false,
      formError:
        result.reason === "OVERLAP"
          ? "Selected dates overlap an existing booking."
          : "Unable to create booking.",
    };
  }

  // 4) Best-effort Google Calendar write
  let eventId: string | null = null;
  let htmlLink: string | undefined;

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
      htmlLink = cal.htmlLink ?? undefined; // fix string|null -> string|undefined
    }
  } catch {
    // Non-fatal: DB booking already succeeded
  }

  return {
    ok: true,
    bookingId: result.bookingId,
    calendar: eventId ? { eventId, htmlLink } : undefined,
  };
}
