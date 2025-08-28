/**
 * Tiny Google Calendar client (service account) for all-day bookings.
 * - Creates all-day events with EXCLUSIVE end (end = day after endYmd).
 * - Returns both { id, htmlLink } for UI convenience.
 * - Provides a safe deleteEvent(eventId) helper for ops reversals.
 */

import { google, calendar_v3 } from "googleapis";

// Types

export type CreateAllDayEventArgs = {
  summary: string;
  description?: string;
  /** Inclusive start Y-M-D, e.g. "2025-09-02" */
  startYmd: string;
  /** Inclusive end Y-M-D, e.g. "2025-09-05" (exclusive end will be +1 day internally) */
  endYmd: string;
};

export type CreatedEventRef = {
  id: string | null;
  htmlLink: string | null;
};

// Internals

function getTimezone(): string {
  return process.env.GOOGLE_CALENDAR_TIMEZONE || "Europe/Lisbon";
}

/** Auth: service account JWT with Calendar scope */
function getAuth() {
  const clientEmail = process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_CALENDAR_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error("Google Calendar env vars are not set");
  }
  // Vercel often stores multiline keys with \n escapes.
  privateKey = privateKey.replace(/\\n/g, "\n");

  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
}

function getCalendar() {
  return google.calendar({ version: "v3", auth: getAuth() });
}

/** Return YYYY-MM-DD string for the day after ymd (UTC-safe) */
function nextDay(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  const y = d.getUTCFullYear();
  const m = `${d.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${d.getUTCDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Build RFC3339 string at UTC midnight for a given YMD */
function ymdToUtcMidnight(ymd: string): string {
  return `${ymd}T00:00:00.000Z`;
}

/** Parse a Calendar API event into [startInstant, endInstantExclusive] */
function eventInstantsUTC(
  ev: calendar_v3.Schema$Event
): { start: Date; endExclusive: Date } | null {
  const s = ev.start;
  const e = ev.end;
  if (!s || !e) return null;

  // All-day: start.date / end.date (end is exclusive per Google)
  if (s.date && e.date) {
    return {
      start: new Date(`${s.date}T00:00:00.000Z`),
      endExclusive: new Date(`${e.date}T00:00:00.000Z`),
    };
  }

  // Timed: use dateTime (includes timezone/offset)
  if (s.dateTime && e.dateTime) {
    return { start: new Date(s.dateTime), endExclusive: new Date(e.dateTime) };
  }

  // Mixed shapes are rare; be conservative and ignore.
  return null;
}

/** Standard time-range overlap: [aStart, aEnd) overlaps [bStart, bEnd) */
function rangesOverlap(
  aStart: Date,
  aEndExclusive: Date,
  bStart: Date,
  bEndExclusive: Date
) {
  return aStart < bEndExclusive && aEndExclusive > bStart;
}

// Public API

/**
 * Create an all-day event with exclusive end.
 * Returns { id, htmlLink }. Either can be null if the API omits it.
 */
export async function createAllDayEvent(
  args: CreateAllDayEventArgs
): Promise<CreatedEventRef> {
  const { summary, description, startYmd, endYmd } = args;
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  if (!calendarId) throw new Error("GOOGLE_CALENDAR_ID not configured");

  const tz = getTimezone();
  const endExclusive = nextDay(endYmd);

  const calendar = getCalendar();
  const res = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary,
      description,
      start: { date: startYmd, timeZone: tz },
      end: { date: endExclusive, timeZone: tz },
      transparency: "opaque",
    },
  });

  return {
    id: res.data.id ?? null,
    htmlLink: res.data.htmlLink ?? null,
  };
}

/** Best-effort delete; returns true if Google accepted the delete (or it didn't exist). */
export async function deleteEvent(eventId: string): Promise<boolean> {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  if (!calendarId) throw new Error("GOOGLE_CALENDAR_ID not configured");

  const calendar = getCalendar();
  try {
    await calendar.events.delete({ calendarId, eventId });
    return true;
  } catch (err: any) {
    // If the event doesn't exist (410/404), treat as success for idempotency.
    const status = err?.code || err?.response?.status;
    if (status === 404 || status === 410) return true;
    console.error("deleteEvent failed:", err);
    return false;
  }
}

/**
 * Check if the calendar already has any (non-cancelled, busy) event overlapping the inclusive
 * all-day range [startYmd, endYmd]. We expand recurring events with singleEvents=true.
 */
export async function hasCalendarOverlap(params: {
  startYmd: string;
  endYmd: string;
}): Promise<boolean> {
  const { startYmd, endYmd } = params;
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  if (!calendarId) throw new Error("GOOGLE_CALENDAR_ID not configured");

  const timeMin = ymdToUtcMidnight(startYmd);
  const timeMax = ymdToUtcMidnight(nextDay(endYmd)); // exclusive end

  const calendar = getCalendar();
  // We only need a handful; ops calendar volume is low. Increase if needed.
  const res = await calendar.events.list({
    calendarId,
    singleEvents: true, // expand recurring
    showDeleted: false,
    timeMin,
    timeMax,
    orderBy: "startTime",
    maxResults: 50,
  });

  const items = res.data.items ?? [];
  if (!items.length) return false;

  const newStart = new Date(timeMin);
  const newEndExclusive = new Date(timeMax);

  for (const ev of items) {
    if (!ev) continue;
    // Ignore free/translucent events; block only BUSY times.
    if (ev.transparency === "transparent") continue;
    if (ev.status === "cancelled") continue;

    const inst = eventInstantsUTC(ev);
    if (!inst) continue;

    if (
      rangesOverlap(inst.start, inst.endExclusive, newStart, newEndExclusive)
    ) {
      return true;
    }
  }

  return false;
}
