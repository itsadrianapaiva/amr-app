import { z } from "zod";
import { differenceInCalendarDays } from "date-fns";

/**
 * Schema for the date range widget.
 * Keeps "from" and "to" optional so RHF can initialize empty state.
 * Then we add rules to require both and ensure chronological order.
 */


// Schema with dateRange inside the form, plus simple field validation
const dateRangeSchema = z
  .object({
    from: z.date().optional(),
    to: z.date().optional(),
  })
  // ensure from and to are actually selected
  .refine((r) => !!r.from, {
    message: "Select a start date",
    path: ["from"],
  })
  .refine((r) => !!r.to, {
    message: "Select an end date",
    path: ["to"],
  })
  // checks that to(end) is after from(start)
  .refine((r) => r.from && r.to && r.from <= r.to, {
    message: "End date cannot be before start",
    path: ["to"],
  })
  // ensures at least one rental day is selected
  //NEED TO CHANGE THIS TO EACH MACHINE BC VARIES
  .refine(
    (r) => r.from && r.to && differenceInCalendarDays(r.to, r.from) + 1 >= 1,
    {
      message: "Select at least one rental day",
      path: ["to"],
    }
  );

/**
 * Base form schema without runtime policies.
 * We keep minimum field rules here.
 */
export const baseBookingFormSchema = z.object({
  dateRange: dateRangeSchema,
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  email: z.string().regex(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, {
    message: "Please enter a valid email",
  }),
  phone: z
    .string()
    .min(9, { message: "Please enter a valid phone number" })
    .max(20, { message: "Phone number is too long" }),
});

/**
 * Build a schema with runtime business rules.
 * For now: start date must be >= minStart (tomorrow).
 * Later: we will also enforce machine.minDays here.
 */
export function buildBookingSchema(minStart: Date) {
  return baseBookingFormSchema.superRefine((data, ctx) => {
    const from = data.dateRange.from;
    if (from && from < minStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dateRange", "from"],
        message: "Start date cannot be today or in the past",
      });
    }
  });
}

// Helpful type for RHF generics
// Automatically creates a type based on the schema.
//If ever change the schema, type updates automatically
export type BookingFormValues = z.infer<typeof baseBookingFormSchema>;
