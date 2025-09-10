// Goal: The function's job is to take a list of bookings (which might be overlapping or messy)
// and produce a clean, minimal list of date ranges that need to be blocked in the calendar.

import { compareAsc, max as maxDate } from "date-fns";

// A minimal shape need for bookings. Raw input.
export type BookingSpan = { startDate: Date; endDate: Date };

// DayPicker accepts { from: Date; to: Date } for range matchers
export type DisabledRange = { from: Date; to: Date };

// Safer to cross the RSC(server-client) boundary as string
export type DisabledRangeJSON = {
  from: string;
  to: string;
};

/**
 * computeDisabledRanges
 * Input: a list of booking spans (start/end dates) that are already normalized
 *        by the caller to their intended day boundaries.
 * Output: merged, minimal ranges where selection must be disabled,
 *         plus a JSON-friendly copy for RSC.
 */
export function computeDisabledRanges(spans: BookingSpan[]): {
  ranges: DisabledRange[];
  json: DisabledRangeJSON[];
} {
  // 1) Fast path
  if (!spans.length) return { ranges: [], json: [] };

  // 2) TRUST caller-provided instants; do NOT re-normalize to start/endOfDay here.
  //    availability.server.ts already converts raw DB rows to Lisbon start/end-of-day in UTC.
  const normalized = spans
    .map((s) => ({ from: s.startDate, to: s.endDate }))
    .sort((a, b) => compareAsc(a.from, b.from));

  // 3) Merge overlaps/touching intervals inclusively
  const merged: DisabledRange[] = [];
  for (const cur of normalized) {
    const last = merged[merged.length - 1];
    if (!last) {
      merged.push({ from: cur.from, to: cur.to });
      continue;
    }
    // Inclusive merge: if current starts on/before last.to, extend
    if (cur.from <= last.to) {
      last.to = maxDate([last.to, cur.to]);
    } else {
      merged.push({ from: cur.from, to: cur.to });
    }
  }

  // 4) JSON-safe copy
  const json = merged.map((r) => ({
    from: r.from.toISOString(),
    to: r.to.toISOString(),
  }));

  return { ranges: merged, json };
}
