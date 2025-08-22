/**
 * Derive a single user-facing error message for the booking date range.
 * Prefers Zod field messages, then enforces the machine minimum days rule.
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

  // Prefer schema-produced messages first
  const fromMsg = errors?.dateRange?.from?.message;
  const toMsg = errors?.dateRange?.to?.message;

  let message: string | undefined =
    typeof fromMsg === "string"
      ? fromMsg
      : typeof toMsg === "string"
      ? toMsg
      : undefined;

  // If schema is quiet but the selection violates minimum days, show a clear rule
  if (!message && rentalDays > 0 && rentalDays < minDays) {
    message = `Minimum rental is ${minDays} ${
      minDays > 1 ? "days" : "day"
    }. You selected ${rentalDays}.`;
  }

  return { message, invalid: Boolean(message) };
}
