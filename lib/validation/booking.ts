import { z } from "zod";
import { differenceInCalendarDays } from "date-fns";

// Section: helpers
/** Inclusive rental days (e.g., 10→12 = 3 days). */
function rentalDays(from: Date, to: Date) {
  return differenceInCalendarDays(to, from) + 1;
}

// Section: date range schema
const dateRangeSchema = z
  .object({
    from: z.date().optional(),
    to: z.date().optional(),
  })
  .refine((r) => !!r.from, {
    message: "Select a start date",
    path: ["from"],
  })
  .refine((r) => !!r.to, {
    message: "Select an end date",
    path: ["to"],
  })
  .refine((r) => r.from && r.to && r.from <= r.to, {
    message: "End date cannot be before start",
    path: ["to"],
  });

// Section: base form schema
/**
 * Note on business fields:
 * - They are base-optional. Required checks are enforced only when billingIsBusiness=true.
 * Note on customerNIF:
 * - Optional personal NIF for receipts. If provided, must be 9 digits.
 */
export const baseBookingFormSchema = z
  .object({
    // Dates
    dateRange: dateRangeSchema,

    // Contact
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
    customerNIF: z.string().optional().nullable(),

    // Add-ons
    deliverySelected: z.coerce.boolean().default(true),
    pickupSelected: z.coerce.boolean().default(true),
    insuranceSelected: z.coerce.boolean().default(true),
    operatorSelected: z.coerce.boolean().default(false),

    // Business invoicing toggle + fields
    billingIsBusiness: z.coerce.boolean().default(false),

    // Base-optional invoicing fields
    billingCompanyName: z.string().optional().nullable(),
    billingTaxId: z.string().optional().nullable(),
    billingAddressLine1: z.string().optional().nullable(),
    billingPostalCode: z.string().optional().nullable(),
    billingCity: z.string().optional().nullable(),
    billingCountry: z.string().optional().nullable(),
  })
  .superRefine((val, ctx) => {
    // Require invoicing fields only when booking as a business
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

    // Optional personal NIF validation - only if provided
    const nif = val.customerNIF?.trim();
    if (nif && !/^\d{9}$/.test(nif)) {
      ctx.addIssue({
        code: "custom",
        message: "Enter a valid NIF (9 digits)",
        path: ["customerNIF"],
      });
    }
  });

// Section: composed schema with runtime business rules
export function buildBookingSchema(minStart: Date, minDays: number) {
  return baseBookingFormSchema.superRefine((data, ctx) => {
    const { from, to } = data.dateRange;

    // Start date must be >= minStart
    if (from && from < minStart) {
      ctx.addIssue({
        code: "custom",
        path: ["dateRange", "from"],
        message: "Start date cannot be today or in the past",
      });
    }

    // Enforce machine-specific minimum days
    if (from && to) {
      const days = rentalDays(from, to);
      if (days < minDays) {
        ctx.addIssue({
          code: "custom",
          path: ["dateRange", "to"],
          message: `Minimum rental is ${minDays} day${
            minDays > 1 ? "s" : ""
          } - you selected ${days}.`,
        });
      }
    }
  });
}

// Section: export type for RHF generics
export type BookingFormValues = z.infer<typeof baseBookingFormSchema>;
