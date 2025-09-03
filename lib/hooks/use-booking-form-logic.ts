"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { addDays, differenceInCalendarDays } from "date-fns";

import type { DisabledRangeJSON } from "@/lib/availability";
import type { BookingFormValues } from "@/lib/validation/booking";
import { startOfLisbonDayUTC } from "@/lib/dates/lisbon";

/**
 * Centralizes common booking-form wiring:
 * - Computes minStart (tomorrow 00:00 Lisbon) or accepts an override
 * - Initializes RHF with your schema
 * - Derives rentalDays and disabledDays (server + policy)
 *
 * IMPORTANT: We accept the concrete Zod schema INSTANCE from the caller.
 * That keeps generics perfectly aligned with what the container uses.
 */
export function useBookingFormLogic(args: {
  schema: any; // Zod schema instance for BookingFormValues
  disabledRangesJSON?: DisabledRangeJSON[];
  /** Optional initial values to avoid post-mount resets in containers */
  defaultValues?: Partial<BookingFormValues>;
  /** Optional: override earliest selectable start (use from useDatePolicy for heavy machines) */
  minStart?: Date;
}) {
  const {
    schema,
    disabledRangesJSON,
    defaultValues,
    minStart: minStartOverride,
  } = args;

  // Base defaults for a pristine form; callers can override via defaultValues
  const baseDefaults: BookingFormValues = {
    dateRange: { from: undefined, to: undefined },
    name: "",
    email: "",
    phone: "",
    customerNIF: "",
    // Add-ons live in the schema too; caller may provide them here to override
    deliverySelected: true,
    pickupSelected: true,
    insuranceSelected: true,
    operatorSelected: false,
    // basic billing defaults
    billingIsBusiness: false,
    billingCompanyName: "",
    billingTaxId: "",
    billingAddressLine1: "",
    billingPostalCode: "",
    billingCity: "",
    billingCountry: "",
  };

  const mergedDefaults: BookingFormValues = {
    ...baseDefaults,
    ...(defaultValues as BookingFormValues | undefined),
  };

  // Earliest allowed start:
  // - If caller provided an override (from useDatePolicy), use it.
  // - Else default to "tomorrow 00:00 Lisbon" (expressed as a UTC Date).
  const minStart = useMemo(() => {
    if (minStartOverride) return minStartOverride;
    const todayLisbon = startOfLisbonDayUTC(new Date());
    return addDays(todayLisbon, 1);
  }, [minStartOverride]);

  // Initialize RHF once, using the provided schema and merged defaults
  const form = useForm<BookingFormValues>({
    resolver: zodResolver(schema),
    defaultValues: mergedDefaults,
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
