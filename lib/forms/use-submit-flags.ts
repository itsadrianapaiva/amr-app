// Centralizes submit-related flags for the booking form.
// Keeps the component lean and avoids re-deriving the same booleans.
//
// Single responsibility:
// - Decide when the submit button should be disabled
// - Expose current "submitting" state and root error message

"use client";

import * as React from "react";
import type { UseFormReturn } from "react-hook-form";
import type { BookingFormValues } from "@/lib/validation/booking";

type UseSubmitFlagsOpts = {
  form: UseFormReturn<BookingFormValues>;
  rentalDays: number;
  isDateInvalid: boolean;
};

export function useSubmitFlags({
  form,
  rentalDays,
  isDateInvalid,
}: UseSubmitFlagsOpts) {
  // Read only what we need from RHF; this keeps re-renders minimal.
  const isSubmitting = form.formState.isSubmitting;
  const rootError = (form.formState.errors.root?.message ??
    null) as string | null;

  // Disable when user is submitting, date selection is invalid, or no days picked.
  const isSubmitDisabled = React.useMemo(
    () => isSubmitting || isDateInvalid || rentalDays === 0,
    [isSubmitting, isDateInvalid, rentalDays]
  );

  return { isSubmitDisabled, isSubmitting, rootError };
}
