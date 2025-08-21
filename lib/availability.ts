import { startOfDay, endOfDay, compareAsc, max as maxDate } from "date-fns";

// A minimal shape need for bookings
export type BookingSpan = { startDate: Date; endDate: Date };

// DayPicker accepts { from: Date; to: Date } for range matchers
export type DisabledRange = { from: Date; to: Date };

// Safer to cross the RSC boundary as string
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
  //1. Trivial fast-path
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
