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
export const baseBookingFormSchema = z
  .object({
    //Dates
    dateRange: dateRangeSchema,

    //Contact
    name: z.string().min(2, { message: "Name is required." }),
    email: z
      .string()
      .regex(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, {
        message: "Enter a valid email",
      }),
    phone: z
      .string()
      .min(9, { message: "Enter a valid phone number" })
      .max(20, { message: "Phone number is too long" }),

    // Add-ons
    deliverySelected: z.coerce.boolean().default(true),
    pickupSelected: z.coerce.boolean().default(true),
    insuranceSelected: z.coerce.boolean().default(true),
    operatorSelected: z.coerce.boolean().default(false),

    // Business invoicing toggle + fields
    billingIsBusiness: z.coerce.boolean().default(false),

    // Base-optional: empty strings from RHF are allowed here; we enforce when billingIsBusiness=true
    billingCompanyName: z.string().optional().nullable(),
    billingTaxId: z.string().optional().nullable(),
    billingAddressLine1: z.string().optional().nullable(),
    billingPostalCode: z.string().optional().nullable(),
    billingCity: z.string().optional().nullable(),
    billingCountry: z.string().optional().nullable(),
  })
  .superRefine((val, ctx) => {
    // Conditionally require invoicing fields only when booking as a business
    if (val.billingIsBusiness) {
      if (!val.billingCompanyName?.trim()) {
        ctx.addIssue({
          code: "custom",
          message: "Company name is required",
          path: ["billingCompanyName"],
        });
      }
      if (!val.billingTaxId?.trim()) {
        ctx.addIssue({
          code: "custom",
          message: "Tax ID is required",
          path: ["billingTaxId"],
        });
      }
      if (!val.billingAddressLine1?.trim()) {
        ctx.addIssue({
          code: "custom",
          message: "Address is required",
          path: ["billingAddressLine1"],
        });
      }
      if (!val.billingPostalCode?.trim()) {
        ctx.addIssue({
          code: "custom",
          message: "Postal code is required",
          path: ["billingPostalCode"],
        });
      }
      if (!val.billingCity?.trim()) {
        ctx.addIssue({
          code: "custom",
          message: "City is required",
          path: ["billingCity"],
        });
      }
      if (!val.billingCountry?.trim()) {
        ctx.addIssue({
          code: "custom",
          message: "Country is required",
          path: ["billingCountry"],
        });
      }
    }
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
