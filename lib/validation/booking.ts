import { z } from "zod";
import { differenceInCalendarDays } from "date-fns";

/**
 * Small helper to compute inclusive rental days.
 * Example: 2025-08-10 to 2025-08-12 => 3 days.
 */
function rentalDays(from: Date, to: Date) {
  return differenceInCalendarDays(to, from) + 1;
}

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
  });

/**
 * Base form schema without runtime policies.
 * Add-ons are optional booleans a user must review, not forced to true.
 * We use z.coerce.boolean() to accept "on"/"true"/"false" from FormData as well.
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
  // Add-ons (explicit fields, default false if missing)
  deliverySelected: z.coerce.boolean().default(false),
  pickupSelected: z.coerce.boolean().default(false),
  insuranceSelected: z.coerce.boolean().default(false),
});

/**
 * Build a schema with runtime business rules.
 * - Start date must be >= minStart (typically tomorrow).
 * - Enforce machine-specific minimum days.
 */
export function buildBookingSchema(minStart: Date, minDays: number) {
  return baseBookingFormSchema.superRefine((data, ctx) => {
    const { from, to } = data.dateRange;

    // Rule 1: start date must be >= minStart
    if (from && from < minStart) {
      ctx.addIssue({
        code: "custom",
        path: ["dateRange", "from"],
        message: "Start date cannot be today or in the past",
      });
    }

    // Rule 2: minDays per machine
    if (from && to) {
      const days = rentalDays(from, to);
      if (days < minDays) {
        ctx.addIssue({
          code: "custom",
          path: ["dateRange", "to"],
          message: `Minimum rental is ${minDays} day${
            minDays > 1 ? "s" : ""
          } — you selected ${days}.`,
        });
      }
    }
  });
}

// Helpful type for RHF(react hook form) generics
export type BookingFormValues = z.infer<typeof baseBookingFormSchema>;
