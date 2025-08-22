"use client";

import { DateRange, Matcher } from "react-day-picker";
import { Control } from "react-hook-form";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { DateRangeInput } from "@/components/booking/date-range-input";

type DateRangeSectionProps = {
  /** RHF control from the parent form */
  control: Control<any>;
  /** Disabled days matcher list passed to the calendar */
  disabledDays?: Matcher | Matcher[];
  /** Small helper text under the calendar */
  helperText?: string;
  /** When true, render a red ring and the alert above */
  isInvalid?: boolean;
  /** Message shown in the alert when invalid */
  errorMessage?: string;
  /** Optional callback so parent can trigger validation immediately */
  onRangeChange?: (range: DateRange | undefined) => void;
};

/**
 * DateRangeSection
 * Minimal, focused UX for date selection:
 * - Optional alert above the calendar when invalid
 * - Red ring around the calendar wrapper when invalid
 * - No schema knowledge. Parent decides isInvalid and errorMessage.
 */
export function DateRangeSection({
  control,
  disabledDays,
  helperText,
  isInvalid = false,
  errorMessage,
  onRangeChange,
}: DateRangeSectionProps) {
  return (
    <FormField
      control={control}
      name="dateRange"
      render={({ field }) => (
        <FormItem className="flex flex-col">
          <FormLabel>Rental Dates</FormLabel>

          {/* Inline alert: only when invalid and we have something useful to say */}
          {isInvalid && errorMessage ? (
            <div
              role="alert"
              aria-live="polite"
              className="mb-3 rounded-md border border-red-700/30 bg-red-700/10 px-3 py-2 text-sm"
            >
              <span className="font-medium text-red-700">
                Check your dates:{" "}
              </span>
              <span className="text-muted-bakckground">{errorMessage}</span>
            </div>
          ) : null}

          <FormControl>
            {/* Focusable wrapper so parent can move focus here if needed */}
            <div
              id="date-range-root"
              tabIndex={-1}
              aria-invalid={isInvalid || undefined}
              className={`rounded-md ${
                isInvalid ? "ring-2 ring-red-700 p-1" : ""
              }`}
            >
              <DateRangeInput
                value={field.value as DateRange | undefined}
                onChange={(range) => {
                  // Update RHF then let parent optionally trigger validation
                  field.onChange(range);
                  onRangeChange?.(range);
                }}
                disabledDays={disabledDays}
                helperText={helperText}
              />
            </div>
          </FormControl>

          {/* Keep the standard inline message for detailed field-level errors */}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
