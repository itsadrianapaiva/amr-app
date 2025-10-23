import { z } from "zod";
import { differenceInCalendarDays } from "date-fns";
import { startOfLisbonDayUTC, LISBON_TZ } from "@/lib/dates/lisbon";

// Section: helpers
/** Inclusive rental days (e.g., 10→12 = 3 days) in LISBON calendar space. */
function rentalDays(from: Date, to: Date) {
  const f = startOfLisbonDayUTC(from); // normalize to 00:00 Lisbon (expressed in UTC)
  const t = startOfLisbonDayUTC(to); // normalize to 00:00 Lisbon (expressed in UTC)
  return differenceInCalendarDays(t, f) + 1;
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

/** Operational address for delivery/pickup (NOT invoicing) */
const siteAddressSchema = z.object({
  line1: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// Section: base form schema
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

    // Operational site address (base-optional)
    siteAddress: siteAddressSchema.optional(),

    // Business invoicing toggle + fields
    billingIsBusiness: z.coerce.boolean().default(false),

    // Base-optional invoicing fields
    billingCompanyName: z.string().optional().nullable(),
    billingTaxId: z.string().optional().nullable(),
    billingAddressLine1: z.string().optional().nullable(),
    billingPostalCode: z.string().optional().nullable(),
    billingCity: z.string().optional().nullable(),
    billingCountry: z.string().optional().nullable(),

    // Discount (applied based on company Tax ID)
    discountPercentage: z.coerce.number().min(0).max(100).default(0),
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

    // Require siteAddress when either delivery OR pickup is selected
    const needsSite = Boolean(val.deliverySelected || val.pickupSelected);
    if (needsSite) {
      const sa = val.siteAddress ?? {};
      if (!sa.line1?.trim()) {
        ctx.addIssue({
          code: "custom",
          message: "Delivery/Pickup address is required",
          path: ["siteAddress", "line1"],
        });
      }
      if (!sa.postalCode?.trim()) {
        ctx.addIssue({
          code: "custom",
          message: "Postal code is required",
          path: ["siteAddress", "postalCode"],
        });
      }
      if (!sa.city?.trim()) {
        ctx.addIssue({
          code: "custom",
          message: "City is required",
          path: ["siteAddress", "city"],
        });
      }
    }
  });

// Section: composed schema with runtime business rules
export function buildBookingSchema(minStart: Date, minDays: number) {
  // Normalize minStart into Lisbon calendar-day start (defensive; callers already pass a Lisbon 00:00 UTC)
  const minStartLisbon = startOfLisbonDayUTC(minStart);

  return baseBookingFormSchema.superRefine((data, ctx) => {
    const rawFrom = data.dateRange.from;
    const rawTo = data.dateRange.to;

    // Normalize user-selected dates to Lisbon calendar-day start
    const from = rawFrom ? startOfLisbonDayUTC(rawFrom) : undefined;
    const to = rawTo ? startOfLisbonDayUTC(rawTo) : undefined;

    // Start date must be >= minStart (both in Lisbon day space)
    if (from && from < minStartLisbon) {
      const friendly = minStartLisbon.toLocaleDateString("en-GB", {
        timeZone: LISBON_TZ,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      ctx.addIssue({
        code: "custom",
        path: ["dateRange", "from"],
        message: `Earliest start is ${friendly}.`,
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
