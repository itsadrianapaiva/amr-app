/**
 * Parse and normalize booking input.
 * - Wraps the Zod schema produced by buildBookingSchema.
 * - Normalizes dateRange to Lisbon day space.
 * - Produces a friendly siteAddrStr for geocoding while preserving original structured address.
 */

import { buildBookingSchema } from "@/lib/validation/booking";
import { asLisbonDateOnly, rentalDaysInclusive } from "@/lib/dates/lisbon";

/** Minimal shape the action needs after parsing. */
export type ParsedBooking = {
  from: Date;
  to: Date;
  days: number;
  /** Original parsed payload (siteAddress, booleans, customer fields, etc.). */
  payload: any;
  /** Free-text address derived from payload.siteAddress for geocoding. */
  siteAddrStr: string;
};

/** Turn structured address into a single string for geocoding. */
function normalizeAddressToString(addr: unknown): string {
  if (typeof addr === "string") return addr;
  if (addr && typeof addr === "object") {
    const a = addr as Record<string, unknown>;
    return [a.line1, a.postalCode, a.city, "Portugal"]
      .filter(Boolean)
      .join(", ");
  }
  return "";
}

/**
 * parseBookingInput
 * @param raw - unknown input from the client
 * @param opts.minStart - earliest allowed Lisbon-start UTC (server policy)
 * @param opts.minDays - machine minimum rental days
 * @returns ParsedBooking with Lisbon-normalized dates and a geocoding-ready address string
 */
export function parseBookingInput(
  raw: unknown,
  opts: { minStart: Date; minDays: number }
): ParsedBooking {
  const { minStart, minDays } = opts;

  // Build runtime schema with policy knobs.
  const schema = buildBookingSchema(minStart, minDays);

  // Normalize incoming dates to Lisbon day space before Zod parsing.
  const cast = raw as any;
  const parsed = schema.parse({
    ...(cast as Record<string, unknown>),
    dateRange: {
      from: asLisbonDateOnly(cast?.dateRange?.from),
      to: asLisbonDateOnly(cast?.dateRange?.to),
    },
  });

  // Extract normalized dates and compute inclusive days in Lisbon day space.
  const from: Date = parsed.dateRange.from!;
  const to: Date = parsed.dateRange.to!;
  const days = rentalDaysInclusive(from, to);

  // Build a free-text address for geocoding while preserving original structured address.
  const siteAddrStr = normalizeAddressToString(parsed.siteAddress);

  return { from, to, days, payload: parsed, siteAddrStr };
}
