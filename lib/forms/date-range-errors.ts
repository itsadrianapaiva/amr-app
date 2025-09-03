// lib/forms/date-range-errors.ts

/**
 * Derive a combined user-facing error message for the booking date range.
 * Aggregates messages from both "from" and "to" and adds a min-days fallback
 * if the schema didn't already produce one.
 */
export function deriveDateRangeError(args: {
  errors?: {
    dateRange?: {
      from?: { message?: unknown };
      to?: { message?: unknown };
    };
  };
  rentalDays: number;
  minDays: number;
}): { message?: string; invalid: boolean } {
  const { errors, rentalDays, minDays } = args;

  const messages: string[] = [];

  // Collect schema-produced messages (from + to)
  const fromMsg = errors?.dateRange?.from?.message;
  if (typeof fromMsg === "string" && fromMsg.trim()) {
    messages.push(fromMsg.trim());
  }

  const toMsg = errors?.dateRange?.to?.message;
  if (typeof toMsg === "string" && toMsg.trim()) {
    messages.push(toMsg.trim());
  }

  // If schema didn't already include a min-days violation, add a clear fallback
  const hasMinDaysMsg = messages.some((m) => /minimum rental/i.test(m));
  if (!hasMinDaysMsg && rentalDays > 0 && rentalDays < minDays) {
    messages.push(
      `Minimum rental is ${minDays} ${minDays > 1 ? "days" : "day"}. You selected ${rentalDays}.`
    );
  }

  // De-duplicate and join with a readable separator
  const unique = Array.from(new Set(messages));
  const message = unique.length ? unique.join(" • ") : undefined;

  return { message, invalid: Boolean(message) };
}
