"use client";

import { useMemo } from "react";
import { useForm, type Resolver, type FieldValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { addDays, differenceInCalendarDays } from "date-fns";
import type { ZodType } from "zod";

import type { DisabledRangeJSON } from "@/lib/availability";
import type { BookingFormValues } from "@/lib/validation/booking";
import { startOfLisbonDayUTC } from "@/lib/dates/lisbon";

/** Concrete Zod schema type for this form's values (caller passes an instance). */
type BookingSchema = ZodType<BookingFormValues>;

/**
 * Narrow shim to stabilize resolver typing across resolver/Zod versions without any.
 * Localize the cast here so the rest stays strongly typed.
 */
function typedZodResolver<T extends FieldValues>(schema: unknown): Resolver<T> {
  return zodResolver(schema as never) as unknown as Resolver<T>;
}

export function useBookingFormLogic(args: {
  schema: BookingSchema;
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

  // Base defaults for a pristine form. Callers can override via defaultValues.
  const baseDefaults: BookingFormValues = {
    dateRange: { from: undefined, to: undefined },
    name: "",
    email: "",
    phone: "",
    customerNIF: "",
    deliverySelected: true,
    pickupSelected: true,
    insuranceSelected: true,
    operatorSelected: false,
    discountPercentage: 0,
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
    ...(defaultValues ?? {}),
  };

  // Earliest allowed start:
  // If caller provided an override (from useDatePolicy), use it.
  // Else default to tomorrow 00:00 Lisbon (as a UTC Date).
  const minStart = useMemo(() => {
    if (minStartOverride) return minStartOverride;
    const todayLisbon = startOfLisbonDayUTC(new Date());
    return addDays(todayLisbon, 1);
  }, [minStartOverride]);

  // Initialize RHF once, using the provided schema and merged defaults
  const form = useForm<BookingFormValues>({
    resolver: typedZodResolver<BookingFormValues>(schema),
    defaultValues: mergedDefaults,
    mode: "onChange",
  });

  // Derive rental days from current form state
  const dateRange = form.watch("dateRange");
  const rentalDays = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return 0;
    return differenceInCalendarDays(dateRange.to, dateRange.from) + 1;
  }, [dateRange]);

  // Convert server JSON to Date objects for Calendar disabled prop
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
