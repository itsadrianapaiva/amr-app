/**
 * Parse and normalize booking input.
 * - Wraps the Zod schema produced by buildBookingSchema.
 * - Normalizes dateRange to Lisbon day space.
 * - Produces a friendly siteAddrStr for geocoding while preserving original structured address.
 */

import { buildBookingSchema } from "@/lib/validation/booking";
import type { BookingFormValues } from "@/lib/validation/booking";
import { asLisbonDateOnly, rentalDaysInclusive } from "@/lib/dates/lisbon";

/** Narrow helper for object-like unknowns. */
type UnknownRecord = Record<string, unknown>;

/** Minimal shape the action needs after parsing. */
export type ParsedBooking = {
  from: Date;
  to: Date;
  days: number;
  /** Original parsed payload (fully typed booking values). */
  payload: BookingFormValues;
  /** Free-text address derived from payload.siteAddress for geocoding. */
  siteAddrStr: string;
};

/** Turn structured address into a single string for geocoding. */
function normalizeAddressToString(addr: unknown): string {
  if (typeof addr === "string") return addr;
  if (addr && typeof addr === "object") {
    const a = addr as UnknownRecord;
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
  const input: UnknownRecord =
    raw && typeof raw === "object" ? (raw as UnknownRecord) : {};
  const rawRange =
    input.dateRange && typeof input.dateRange === "object"
      ? (input.dateRange as UnknownRecord)
      : {};

  const parsed = schema.parse({
    ...input,
    dateRange: {
      from: asLisbonDateOnly(rawRange.from as Date | string | undefined),
      to: asLisbonDateOnly(rawRange.to as Date | string | undefined),
    },
  }) as BookingFormValues;

  // Extract normalized dates and compute inclusive days in Lisbon day space.
  const from: Date = parsed.dateRange.from!;
  const to: Date = parsed.dateRange.to!;
  const days = rentalDaysInclusive(from, to);

  // Build a free-text address for geocoding while preserving original structured address.
  const siteAddrStr = normalizeAddressToString(parsed.siteAddress);

  return { from, to, days, payload: parsed, siteAddrStr };
}
