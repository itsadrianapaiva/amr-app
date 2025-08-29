// Bridge between database and availability logic
import { BookingStatus } from "@prisma/client";
import { startOfDay } from "date-fns";

import { db } from "@/lib/db";
import {
  computeDisabledRanges,
  type DisabledRangeJSON,
} from "@/lib/availability";

/* ----------------------------------------------------------------------------
   Lisbon-safe day math (local to this file to avoid changing shared helpers)
   We convert day boundaries to *Lisbon* start/end expressed in UTC.
---------------------------------------------------------------------------- */

const LISBON_TZ = "Europe/Lisbon";

/** Return YYYY-MM-DD as seen on a Lisbon calendar for a given instant. */
function ymdInLisbon(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: LISBON_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "0000";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const dd = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${dd}`;
}

/** Start of a Lisbon calendar day (00:00) expressed in UTC. */
function startOfLisbonDayUtcFromYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  // UTC midnight guess for that YMD
  const guess = new Date(Date.UTC(y, m - 1, d));
  // What is that instant in Lisbon wall time?
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: LISBON_TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(guess);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  const hh = get("hour");
  const mm = get("minute");
  const ss = get("second");
  // Subtract Lisbon clock time to land at 00:00 Lisbon for that YMD, in UTC
  const offsetMs = ((hh * 60 + mm) * 60 + ss) * 1000;
  return new Date(guess.getTime() - offsetMs);
}

/** End of a Lisbon calendar day (23:59:59.999) expressed in UTC. */
function endOfLisbonDayUtcFromYmd(ymd: string): Date {
  // Start of this Lisbon day in UTC
  const start = startOfLisbonDayUtcFromYmd(ymd);
  // Jump into the next Lisbon day, find its start in UTC, then minus 1 ms
  const probe = new Date(start.getTime() + 36 * 60 * 60 * 1000); // safely into "tomorrow"
  const nextYmd = ymdInLisbon(probe);
  const nextStart = startOfLisbonDayUtcFromYmd(nextYmd);
  return new Date(nextStart.getTime() - 1);
}

/** Convert a DisabledRangeJSON to Lisbon-anchored ISO strings (from/to). */
function normalizeToLisbonDay(json: DisabledRangeJSON): DisabledRangeJSON {
  const fromYmd = ymdInLisbon(new Date(json.from));
  const toYmd = ymdInLisbon(new Date(json.to));
  const fromIso = startOfLisbonDayUtcFromYmd(fromYmd).toISOString();
  const toIso = endOfLisbonDayUtcFromYmd(toYmd).toISOString();
  return { from: fromIso, to: toIso };
}

/* ----------------------------------------------------------------------------
   Public API
---------------------------------------------------------------------------- */

/**
 * getDisabledDateRangesForMachine
 * Fetch all relevant bookings for one specific machine and return a clean,
 * JSON-safe array of date ranges that should be disabled in the calendar.
 */
export async function getDisabledDateRangesForMachine(
  machineId: number
): Promise<DisabledRangeJSON[]> {
  // DATABASE QUERY
  // Only care about bookings that haven't fully ended before today
  const today = startOfDay(new Date());

  const bookings = await db.booking.findMany({
    where: {
      machineId,
      status: BookingStatus.CONFIRMED,
      endDate: { gte: today },
    },
    select: {
      startDate: true,
      endDate: true,
    },
    orderBy: {
      startDate: "asc",
    },
  });

  const spans = bookings.map((b) => ({
    startDate: b.startDate,
    endDate: b.endDate,
  }));

  // Compute merged ranges, then re-anchor JSON to Lisbon day boundaries
  const merged = computeDisabledRanges(spans).json;
  return merged.map(normalizeToLisbonDay);
}

/**
 * getDisabledRangesByMachine
 * Fetch CONFIRMED bookings that haven't ended and return a map:
 *    { [machineId]: DisabledRangeJSON[] }
 * for rendering blocked ranges per-machine (e.g., /ops date-range UI).
 */
export async function getDisabledRangesByMachine(): Promise<
  Record<number, DisabledRangeJSON[]>
> {
  const today = startOfDay(new Date());

  // Single roundtrip for all machines; pull minimal fields.
  const bookings = await db.booking.findMany({
    where: {
      status: BookingStatus.CONFIRMED,
      endDate: { gte: today },
    },
    select: {
      machineId: true,
      startDate: true,
      endDate: true,
    },
    orderBy: { startDate: "asc" },
  });

  // Group spans per machineId
  const grouped = new Map<number, Array<{ startDate: Date; endDate: Date }>>();
  for (const b of bookings) {
    const arr = grouped.get(b.machineId) ?? [];
    arr.push({ startDate: b.startDate, endDate: b.endDate });
    grouped.set(b.machineId, arr);
  }

  // Compute merged ranges for each machine, then re-anchor to Lisbon day boundaries
  const out: Record<number, DisabledRangeJSON[]> = {};
  for (const [machineId, spans] of grouped.entries()) {
    const merged = computeDisabledRanges(spans).json;
    out[machineId] = merged.map(normalizeToLisbonDay);
  }
  return out;
}
