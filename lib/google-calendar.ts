import { google } from "googleapis";
import type { calendar_v3 } from "googleapis";
import { addDays } from "date-fns";

/** Shape for creating an all-day event */
export type AllDayEventInput = {
  summary: string; // Title shown on the calendar
  description?: string; // Details we can stuff with machine + add-ons
  startDate: string | Date; // Inclusive, e.g. "2025-09-01"
  endDate: string | Date; // Inclusive, e.g. "2025-09-03"
  location?: string; // Optional customer site address
};

/** Read and validate env, and fix private key newlines */
function getEnv() {
  const email = process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_CALENDAR_PRIVATE_KEY;
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const tz = process.env.GOOGLE_CALENDAR_TIMEZONE || "Europe/Lisbon";

  if (!email) throw new Error("Missing GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL");
  if (!key) throw new Error("Missing GOOGLE_CALENDAR_PRIVATE_KEY");
  if (!calendarId) throw new Error("Missing GOOGLE_CALENDAR_ID");

  // Keys in env often keep \n as literal two characters; convert to real newlines
  const privateKey = key.replace(/\\n/g, "\n");
  return { email, privateKey, calendarId, tz };
}

/** Create an authenticated Calendar client using a JWT service account */
function getCalendar(): calendar_v3.Calendar {
  const { email, privateKey } = getEnv();

  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });

  return google.calendar({ version: "v3", auth });
}

/** Normalize to "YYYY-MM-DD" regardless of Date or string input */
function toYMD(d: string | Date): string {
  if (d instanceof Date) {
    // Use the calendar date portion of the input, independent of local tz
    const utcMidnight = new Date(
      Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
    );
    return utcMidnight.toISOString().slice(0, 10);
  }

  // String input
  const s = d.trim();

  // Already "YYYY-MM-DD"
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // ISO-like strings: "2025-09-01T..."
  const parsed = new Date(s);
  if (!Number.isNaN(+parsed)) {
    return parsed.toISOString().slice(0, 10);
  }

  throw new Error(`Invalid date string: ${d}`);
}

/**
 * Create an all-day event that blocks an inclusive range.
 * Google uses exclusive end dates for all-day events, so we add +1 day.
 */
export async function createAllDayEvent(
  input: AllDayEventInput
): Promise<string> {
  const { calendarId } = getEnv();
  const cal = getCalendar();

  const startYmd = toYMD(input.startDate);
  const endInclusiveYmd = toYMD(input.endDate);
  const endExclusiveYmd = toYMD(
    addDays(new Date(`${endInclusiveYmd}T00:00:00Z`), 1)
  );

  try {
    const res = await cal.events.insert({
      calendarId,
      requestBody: {
        summary: input.summary,
        description: input.description,
        location: input.location,
        start: { date: startYmd }, // all-day: use "date" only
        end: { date: endExclusiveYmd },
      },
    });

    const eventId = res.data.id;
    if (!eventId) throw new Error("Calendar API returned no event id");
    return eventId;
  } catch (err: unknown) {
    const anyErr = err as any;
    const msg =
      anyErr?.errors?.[0]?.message ||
      anyErr?.response?.data?.error?.message ||
      anyErr?.message ||
      "Unknown Google Calendar error";
    throw new Error(`Failed to create calendar event: ${msg}`);
  }
}

/** Optional small helpers for future edits/cancel flows */
export async function deleteEvent(eventId: string): Promise<void> {
  const { calendarId } = getEnv();
  const cal = getCalendar();
  await cal.events.delete({ calendarId, eventId });
}
