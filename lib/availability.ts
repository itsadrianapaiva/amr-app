// Goal: The function's job is to take a list of bookings (which might be overlapping or messy) and produce a clean, minimal list of date ranges that need to be blocked in the calendar. For example, if you have one booking for Aug 21-22 and another for Aug 22-23, the output should be a single disabled range: Aug 21-23.

import { startOfDay, endOfDay, compareAsc, max as maxDate } from "date-fns";

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
 * Input: a list of booking spans (start/end dates)
 * Output: merged, normalized day ranges where selection must be disabled
 * Also returns a JSON-friendly version for Server Components.
 */

export function computeDisabledRanges(spans: BookingSpan[]): {
  ranges: DisabledRange[];
  json: DisabledRangeJSON[];
} {
  //1. Trivial fast-path (guard clause)
  //If there are no bookings, return empty ranges
  if (!spans.length) return { ranges: [], json: [] };

  //2. Normalize each span to full days [00:00 .. 23:59:59.999] and sort ascending
  const normalized = spans
    .map((s) => ({
      from: startOfDay(s.startDate),
      to: endOfDay(s.endDate),
    }))
    .sort((a, b) => compareAsc(a.from, b.from));

  //3. Merge overlapping ranges to keep the UI lean
  const merged: DisabledRange[] = [];
  for (const cur of normalized) {
    const last = merged[merged.length - 1];
    if (!last) {
      merged.push(cur);
      continue;
    }

    //Overlap or touch: if current starts before or at last.to, merge them
    if (cur.from <= last.to) {
      last.to = maxDate([last.to, cur.to]); // Extend the last range
    } else {
      merged.push(cur); // No overlap, push new range
    }
  }

  //4. Prepare JSON-safe copy for crossing the RSC boundary
  const json = merged.map((r) => ({
    from: r.from.toISOString(),
    to: r.to.toISOString(),
  }));

  return { ranges: merged, json };
}
