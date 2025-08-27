import { z } from "zod";

/** Reusable YYYY-MM-DD guard for calendar dates */
export const YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Manager-created booking (OPS) — validation shared by server actions and UI.
 * Keep defaults here so callers can pass minimal payloads during testing.
 */
export const ManagerBookingSchema = z.object({
  // Simple gate checked inside the action; kept here for one-stop validation
  passcode: z.string().min(1, "Missing passcode"),

  // Used in Google Calendar summary/description for traceability
  managerName: z.string().min(1).default("OPS"),

  // Target machine and inclusive date range (YYYY-MM-DD)
  machineId: z.number().int().positive(),
  startDate: z.string().regex(YMD, "Use YYYY-MM-DD"),
  endDate: z.string().regex(YMD, "Use YYYY-MM-DD"),

  // Add-ons (default false to be explicit)
  delivery: z.boolean().optional().default(false),
  pickup: z.boolean().optional().default(false),
  insurance: z.boolean().optional().default(false),
  operator: z.boolean().optional().default(false),

  // Booking schema requires these fields; defaults keep ops quick
  customerName: z.string().min(1).default("OPS Booking"),
  customerEmail: z.string().email().default("ops@example.com"),
  customerPhone: z.string().min(3).default("000000000"),
  customerNIF: z.string().optional().nullable(),

  // Operational site address — maps to 4 DB columns
  siteAddress: z
    .object({
      line1: z.string().optional().nullable(),
      postalCode: z.string().optional().nullable(),
      city: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    })
    .optional(),

  // Total for invoicing/reporting; 0 for waived internal bookings
  totalCost: z.number().nonnegative().default(0),
});

export type ManagerBookingInput = z.infer<typeof ManagerBookingSchema>;
