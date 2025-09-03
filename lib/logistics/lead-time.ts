// Pure helpers for Lisbon-based lead-time validation with a daily cutoff.
// Reuses existing Lisbon date utilities to avoid duplication.

import { addDays, differenceInCalendarDays } from "date-fns";
import { LISBON_TZ, startOfLisbonDayUTC } from "@/lib/dates/lisbon";

/** Get the current hour in Lisbon for a given instant (0–23). */
function getLisbonHour(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LISBON_TZ,
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);
  return Number(parts.find((p) => p.type === "hour")?.value);
}

/**
 * Compute how many full days from "today in Lisbon" are required before a start is allowed.
 * If the Lisbon time is >= cutoffHour (e.g., 15), add +1 day to the lead time.
 */
export function requiredDaysWithCutoff(
  now: Date,
  leadDays: number,
  cutoffHour: number
): number {
  return leadDays + (getLisbonHour(now) >= cutoffHour ? 1 : 0);
}

/**
 * Validate a proposed startDate against lead-time with cutoff (Lisbon-aware).
 * Returns:
 *  - ok: whether the start date meets the rule
 *  - earliestAllowedDay: Date representing 00:00 (Lisbon) of the earliest valid day, expressed in UTC
 *  - minDays: the minimum number of Lisbon calendar days required from "today"
 *
 * Notes:
 *  - We normalize both "now" and "startDate" to Lisbon 00:00 (expressed in UTC) for stable calendar math.
 *  - The returned earliestAllowedDay is ideal for UI min-date and error messages.
 */
export function validateLeadTimeLisbon(params: {
  now?: Date;
  startDate: Date;
  leadDays: number;
  cutoffHour: number;
}) {
  const { startDate, leadDays, cutoffHour } = params;
  const now = params.now ?? new Date();

  const todayLisbonNaive = startOfLisbonDayUTC(now);
  const startLisbonNaive = startOfLisbonDayUTC(startDate);

  const minDays = requiredDaysWithCutoff(now, leadDays, cutoffHour);
  const earliestAllowedDay = addDays(todayLisbonNaive, minDays);

  const dayDiff = differenceInCalendarDays(startLisbonNaive, todayLisbonNaive);
  const ok = dayDiff >= minDays;

  return { ok, earliestAllowedDay, minDays };
}
