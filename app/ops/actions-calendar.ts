export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { z } from "zod";

const CalendarInput = z.object({
  bookingId: z.coerce.number().int().positive(),
  machineId: z.coerce.number().int().positive(),
  startYmd: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "startYmd must be YYYY-MM-DD"),
  endYmd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "endYmd must be YYYY-MM-DD"),
  managerName: z.string().min(1),
  customerName: z.string().optional(),
  siteAddressLine1: z.string().optional(),
  siteAddressCity: z.string().optional(),
  siteAddressNotes: z.string().optional(),
});

export type OpsCalendarResult =
  | { ok: true; eventId: string; htmlLink?: string }
  | { ok: false; formError: string };

/**
 * Create a Calendar event for an already-created OPS booking.
 * DB-first pattern: booking already exists; Calendar is best-effort.
 */
export async function createOpsCalendarEventAction(
  input: unknown
): Promise<OpsCalendarResult> {
  "use server";

  // 1) Validate/coerce ids to numbers to match Prisma types
  const parsed = CalendarInput.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input";
    return { ok: false, formError: msg };
  }
  const {
    bookingId,
    machineId,
    startYmd,
    endYmd,
    managerName,
    customerName,
    siteAddressLine1,
    siteAddressCity,
    siteAddressNotes,
  } = parsed.data;

  try {
    // 2) Lazy-load Node deps
    const [{ db }, calendarMod] = await Promise.all([
      import("@/lib/db"),
      import("@/lib/google-calendar"),
    ]);
    const { createAllDayEvent } = calendarMod;

    // 3) Machine name once for event summary (expects numeric id)
    const machine = await db.machine.findUnique({
      where: { id: machineId },
      select: { name: true },
    });

    const summary = `Machine: ${
      machine?.name ?? `#${machineId}`
    } - Manager: ${managerName}`;
    const locationLine = [siteAddressLine1, siteAddressCity]
      .filter(Boolean)
      .join(", ");
    const description = [
      locationLine ? `Location: ${locationLine}` : null,
      customerName ? `Customer: ${customerName}` : null,
      siteAddressNotes ? `Notes: ${siteAddressNotes}` : null,
      `Booking ID: ${bookingId}`,
      "Source: /ops",
    ]
      .filter(Boolean)
      .join("\n");

    // 4) Create calendar event
    const cal = await createAllDayEvent({
      startYmd,
      endYmd,
      summary,
      description,
    });
    if (!cal?.id)
      return { ok: false, formError: "Calendar returned no event id." };

    // 5) Persist calendar id on booking (expects numeric id)
    await db.booking.update({
      where: { id: bookingId },
      data: { googleCalendarEventId: cal.id },
    });

    return { ok: true, eventId: cal.id, htmlLink: cal.htmlLink ?? undefined };
  } catch (e: any) {
    return { ok: false, formError: e?.message ?? "Calendar action failed" };
  }
}
