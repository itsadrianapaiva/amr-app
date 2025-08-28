import "server-only";
import { z } from "zod";

/**
 * Server-only helper for OPS calendar side-effect.
 * Adds idempotency and rich validation errors for stability & debuggability.
 */

// ---------- Input/Output contracts -------------------------------------------

const Input = z.object({
  bookingId: z.coerce.number().int().positive(),
  machineId: z.coerce.number().int().positive(),
  startYmd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD"),
  endYmd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD"),
  managerName: z.string().min(1, "required"),
  customerName: z.string().optional(),
  siteAddressLine1: z.string().min(1, "required"),
  siteAddressCity: z.string().optional(),
  siteAddressNotes: z.string().optional(),
});

export type OpsCalendarInput = z.infer<typeof Input>;

export type OpsCalendarResult =
  | { ok: true; eventId: string; htmlLink?: string }
  | { ok: false; formError: string };

// ---------- tiny pure helpers ------------------------------------------------

function joinComma(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(", ");
}

function buildEventText(
  machineName: string | null | undefined,
  machineId: number,
  managerName: string,
  locationLine: string,
  customerName?: string,
  notes?: string,
  bookingId?: number
) {
  const summary = `Machine: ${
    machineName ?? `#${machineId}`
  } - Manager: ${managerName}`;
  const lines = [
    locationLine ? `Location: ${locationLine}` : null,
    customerName ? `Customer: ${customerName}` : null,
    notes ? `Notes: ${notes}` : null,
    bookingId ? `Booking ID: ${bookingId}` : null,
    "Source: /ops",
  ]
    .filter(Boolean)
    .join("\n");
  return { summary, description: lines };
}

// ---------- main function ----------------------------------------------------

export async function addBookingToCalendar(
  input: unknown
): Promise<OpsCalendarResult> {
  // 1) Validate/coerce inputs with actionable error detail
  const parsed = Input.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path?.[0].toString() ?? "unknown"}: ${i.message}`)
      .join("; ");
    // Log a compact trace for server debugging (does not leak to client)
    try {
      console.warn("[ops-calendar] invalid input:", {
        issues,
        // Only echo selected keys to avoid logging sensitive info
        snapshot: (() => {
          const o = input as any;
          return {
            bookingId: o?.bookingId,
            machineId: o?.machineId,
            startYmd: o?.startYmd,
            endYmd: o?.endYmd,
            managerName: o?.managerName,
            siteAddressLine1: o?.siteAddressLine1,
          };
        })(),
      });
    } catch {}
    return { ok: false, formError: `Invalid input: ${issues}` };
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
    // 2) Lazy-load heavy deps
    const [{ db }, calendarMod] = await Promise.all([
      import("@/lib/db"),
      import("@/lib/google-calendar"),
    ]);
    const { createAllDayEvent } = calendarMod;

    // 3) IDEMPOTENCY: if booking already has an event id, exit early
    const existing = await db.booking.findUnique({
      where: { id: bookingId },
      select: { googleCalendarEventId: true, machineId: true },
    });
    if (!existing) {
      return { ok: false, formError: "Booking not found" };
    }
    if (existing.googleCalendarEventId) {
      // Already linked — consider this a success and avoid double-creation
      return { ok: true, eventId: existing.googleCalendarEventId };
    }

    // 4) Fetch machine name once for summary
    const machine = await db.machine.findUnique({
      where: { id: machineId },
      select: { name: true },
    });

    const locationLine = joinComma([siteAddressLine1, siteAddressCity]);
    const { summary, description } = buildEventText(
      machine?.name,
      machineId,
      managerName,
      locationLine,
      customerName,
      siteAddressNotes,
      bookingId
    );

    // 5) Create calendar event
    const cal = await createAllDayEvent({
      startYmd,
      endYmd,
      summary,
      description,
    });
    if (!cal?.id) {
      return { ok: false, formError: "Calendar returned no event id." };
    }

    // 6) Persist event id on the booking (best effort)
    try {
      await db.booking.update({
        where: { id: bookingId },
        data: { googleCalendarEventId: cal.id },
      });
    } catch (e: any) {
      console.warn(
        "[ops-calendar] persisted event create but failed to update booking",
        {
          bookingId,
          eventId: cal.id,
          error: e?.message,
        }
      );
      // Non-fatal: calendar event exists
      return { ok: true, eventId: cal.id, htmlLink: cal.htmlLink ?? undefined };
    }

    return { ok: true, eventId: cal.id, htmlLink: cal.htmlLink ?? undefined };
  } catch (e: any) {
    console.error("[ops-calendar] unexpected error", { message: e?.message });
    return {
      ok: false,
      formError: e?.message ?? "Calendar integration failed",
    };
  }
}
