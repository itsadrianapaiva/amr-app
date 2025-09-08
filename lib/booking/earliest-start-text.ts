// Tiny pure helper that returns the calendar hint shown under the date picker.
// It mirrors your previous inline logic, using Lisbon day semantics.
import { addDays } from "date-fns";
import { startOfLisbonDayUTC } from "@/lib/dates/lisbon";

/**
 * earliestStartText
 * @param machineId - numeric id (heavy-transport rule applies to 5/6/7)
 * @param minStart  - Lisbon-normalized earliest allowed start (Date)
 * @param now       - optional "now" for deterministic tests (defaults to new Date())
 */
export function earliestStartText(opts: {
  machineId: number;
  minStart: Date;
  now?: Date;
}): string {
  const { machineId, minStart, now } = opts;

  // Compute "tomorrow" in Lisbon calendar space for comparison
  const tomorrowLisbon = addDays(startOfLisbonDayUTC(now ?? new Date()), 1);

  // Heavy-transport rule for machines 5, 6, 7
  const isHeavy = machineId === 5 || machineId === 6 || machineId === 7;
  const heavyRuleApplies =
    isHeavy && minStart.getTime() > tomorrowLisbon.getTime();

  // Format minStart as DD/MM/YYYY in Lisbon TZ
  const friendly = minStart.toLocaleDateString("en-GB", {
    timeZone: "Europe/Lisbon",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return heavyRuleApplies
    ? `Earliest start is ${friendly} for heavy-transport machines.`
    : "Earliest start is tomorrow. Same-day rentals are not available.";
}
