"use client";

import { useMemo } from "react";
import { addDays } from "date-fns";
import { buildBookingSchema } from "@/lib/validation/booking";
import { startOfLisbonDayUTC } from "@/lib/dates/lisbon";
import { requiredDaysWithCutoff } from "@/lib/logistics/lead-time";

/**
 * useDatePolicy
 * Centralizes earliest allowed start and produces the Zod schema (client-side).
 * Now Lisbon-aware and heavy-machine aware (IDs 5,6,7) with a 2-day lead and 15:00 cutoff.
 */
export function useDatePolicy(args: {
  /** Minimum rental days required by the machine */
  minDays: number;
  /**
   * Offset in whole days from "today" for the earliest allowed start
   * when the machine is NOT heavy. Defaults to 1 to block same-day rentals.
   */
  daysFromToday?: number;
  /** Optional: current machineId to apply heavy-transport rules (5,6,7). */
  machineId?: number;
  /**
   * Optional clock injection for tests. Defaults to () => new Date().
   * Useful to freeze time in unit tests.
   */
  now?: () => Date;
}) {
  const { minDays, daysFromToday = 1, machineId, now } = args;

  //  business knobs (keep in sync with server)
  // hard-coded IDs [5,6,7] per your spec (MVP; we can move to DB later).
  const HEAVY_MACHINE_IDS = useMemo(() => new Set<number>([5, 6, 7]), []);
  const LEAD_DAYS = 2; // requires 2 days for heavy-transport
  const CUTOFF_HOUR = 15; // 15:00 Lisbon → pushes earliest start by +1 day

  // Compute "today" with an overridable clock for testability
  const today = useMemo(() => (now ? now() : new Date()), [now]);

  // Normalize to Lisbon 00:00 to keep calendar math consistent with the server
  const todayLisbonStart = useMemo(() => startOfLisbonDayUTC(today), [today]);

  // If heavy machine: compute earliest allowed via the same cutoff logic used by the server.
  // Else: keep the simpler "N days from today" policy.
  const minStart = useMemo(() => {
    const isHeavy =
      typeof machineId === "number" && HEAVY_MACHINE_IDS.has(machineId);
    if (isHeavy) {
      const minDaysRequired = requiredDaysWithCutoff(
        today,
        LEAD_DAYS,
        CUTOFF_HOUR
      );
      return addDays(todayLisbonStart, minDaysRequired);
    }
    return addDays(todayLisbonStart, daysFromToday);
  }, [machineId, today, todayLisbonStart, daysFromToday, HEAVY_MACHINE_IDS]);

  // Build the concrete Zod schema instance for this policy
  const schema = useMemo(
    () => buildBookingSchema(minStart, minDays),
    [minStart, minDays]
  );

  return { minStart, schema };
}
