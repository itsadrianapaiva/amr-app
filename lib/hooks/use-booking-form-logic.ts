"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { addDays, differenceInCalendarDays, startOfDay } from "date-fns";

import type { DisabledRangeJSON } from "@/lib/availability";
import type { BookingFormValues } from "@/lib/validation/booking";

/**
 * Centralizes common booking-form wiring:
 * - Computes minStart (tomorrow 00:00)
 * - Initializes RHF with your schema
 * - Derives rentalDays and disabledDays (server + policy)
 *
 * IMPORTANT: We accept the concrete Zod schema INSTANCE from the caller.
 * That keeps generics perfectly aligned with what the container uses.
 */
export function useBookingFormLogic(args: {
  schema: any; // Zod schema instance for BookingFormValues (kept as any to avoid generic friction)
  disabledRangesJSON?: DisabledRangeJSON[];
}) {
  const { schema, disabledRangesJSON } = args;

  // Earliest allowed start: tomorrow at 00:00 local time
  const minStart = startOfDay(addDays(new Date(), 1));

  // Initialize RHF once, using the provided schema
  const form = useForm<BookingFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      dateRange: { from: undefined, to: undefined },
      name: "",
      email: "",
      phone: "",
      // If schema includes add-ons with defaults, Zod will supply them post-parse.
      // We keep defaults minimal here to avoid clashes.
    },
    mode: "onChange",
  });

  // Derive rental days from current form state
  const dateRange = form.watch("dateRange");
  const rentalDays = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return 0;
    return differenceInCalendarDays(dateRange.to, dateRange.from) + 1;
  }, [dateRange]);

  // Convert server JSON to Date objects for Calendar "disabled" prop
  const serverDisabled = useMemo(
    () =>
      (disabledRangesJSON ?? []).map((r) => ({
        from: new Date(r.from),
        to: new Date(r.to),
      })),
    [disabledRangesJSON]
  );

  // Policy: block today and all past days
  const disabledDays = useMemo(
    () => [{ before: minStart }, ...serverDisabled],
    [minStart, serverDisabled]
  );

  return {
    form,
    minStart,
    rentalDays,
    disabledDays,
  };
}
