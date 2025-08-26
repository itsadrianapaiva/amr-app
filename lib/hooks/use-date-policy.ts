"use client";

import { useMemo } from "react";
import { addDays, startOfDay } from "date-fns";
import { buildBookingSchema } from "@/lib/validation/booking";

/**
 * useDatePolicy
 * Centralizes "earliest start is tomorrow at 00:00" and produces the Zod schema.
 * Small, deterministic, and easy to test.
 */
export function useDatePolicy(args: {
  /** Minimum rental days required by the machine */
  minDays: number;
  /**
   * Offset in whole days from "today" for the earliest allowed start.
   * Defaults to 1 to block same-day rentals.
   */
  daysFromToday?: number;
  /**
   * Optional clock injection for tests. Defaults to () => new Date().
   * Useful to freeze time in unit tests.
   */
  now?: () => Date;
}) {
  const { minDays, daysFromToday = 1, now } = args;

  // Compute "today" with an overridable clock for testability
  const today = useMemo(() => (now ? now() : new Date()), [now]);

  // Earliest allowed start: N days from "today" at 00:00 local time
  const minStart = useMemo(
    () => startOfDay(addDays(today, daysFromToday)),
    [today, daysFromToday]
  );

  // Build the concrete Zod schema instance for this policy
  const schema = useMemo(() => buildBookingSchema(minStart, minDays), [minStart, minDays]);

  return { minStart, schema };
}
