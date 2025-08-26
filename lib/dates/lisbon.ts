// Tiny, pure helpers to work with calendar-day logic in the Europe/Lisbon timezone.

import { differenceInCalendarDays } from "date-fns";

/** IANA timezone for Lisbon. */
export const LISBON_TZ = "Europe/Lisbon";

/**
 * Extracts year/month/day for a given instant as they would appear on a Lisbon calendar.
 * Uses Intl.DateTimeFormat to avoid DST and offset pitfalls.
 */
export function partsForLisbon(d: Date): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: LISBON_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  return {
    y: Number(parts.find((p) => p.type === "year")?.value),
    m: Number(parts.find((p) => p.type === "month")?.value),
    d: Number(parts.find((p) => p.type === "day")?.value),
  };
}

/**
 * Returns a Date at **00:00 Lisbon** for the given instant, expressed in UTC.
 * Useful for normalizing date-only values crossing server/client timezones.
 */
export function startOfLisbonDayUTC(d: Date): Date {
  const { y, m, d: day } = partsForLisbon(d);
  return new Date(Date.UTC(y, m - 1, day));
}

/**
 * Convenience: start of **tomorrow** in Lisbon (00:00 Lisbon), as a UTC Date.
 * Accepts an optional 'now' for deterministic tests.
 */
export function tomorrowStartLisbonUTC(now: Date = new Date()): Date {
  const { y, m, d } = partsForLisbon(now);
  return new Date(Date.UTC(y, m - 1, d + 1));
}

/**
 * Coerces an unknown value into a Date and normalizes it to **Lisbon day start**.
 * - undefined/null -> undefined
 * - string/Date -> Date at 00:00 Lisbon (expressed in UTC)
 */
export function asLisbonDateOnly(v: unknown): Date | undefined {
  if (!v) return undefined;
  const d = v instanceof Date ? v : new Date(String(v));
  return startOfLisbonDayUTC(d);
}

/**
 * Inclusive rental days between two normalized dates (e.g., 10→12 = 3 days).
 * Assumes both 'from' and 'to' are already normalized to day starts.
 */
export function rentalDaysInclusive(from: Date, to: Date): number {
  return differenceInCalendarDays(to, from) + 1;
}
