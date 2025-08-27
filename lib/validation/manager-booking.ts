import { z } from "zod";
import { partsForLisbon } from "@/lib/dates/lisbon";

/** YYYY-MM-DD pattern */
export const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** Today's date string in Europe/Lisbon (YYYY-MM-DD) using your shared util */
function todayLisbonYMD(): string {
  const { y, m, d } = partsForLisbon(new Date());
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

/**
 * Manager-created booking (OPS) — shared validation for server actions & UI.
 * Defaults keep ops fast; schema enforces date policy.
 */
export const ManagerBookingSchema = z
  .object({
    passcode: z.string().min(1, "Missing passcode"),
    managerName: z.string().min(1).default("OPS"),

    machineId: z.number().int().positive(),
    startDate: z.string().regex(YMD, "Use YYYY-MM-DD"),
    endDate: z.string().regex(YMD, "Use YYYY-MM-DD"),

    // Add-ons default to false; managers don't set them in UI
    delivery: z.boolean().optional().default(false),
    pickup: z.boolean().optional().default(false),
    insurance: z.boolean().optional().default(false),
    operator: z.boolean().optional().default(false),

    // Booking schema requires these; minimal defaults keep ops lightweight
    customerName: z.string().min(1).default("OPS Booking"),
    customerEmail: z.string().default("ops@example.com"),
    customerPhone: z.string().min(3).default("000000000"),
    customerNIF: z.string().optional().nullable(),

    // Operational site address → 4 columns on write
    siteAddress: z
      .object({
        line1: z.string().optional().nullable(),
        postalCode: z.string().optional().nullable(),
        city: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
      })
      .optional(),

    totalCost: z.number().nonnegative().default(0),
  })
  .superRefine((val, ctx) => {
    // Safe string comparisons because inputs are normalized to YYYY-MM-DD
    const today = todayLisbonYMD();

    if (val.startDate < today) {
      ctx.addIssue({
        code: "custom",
        path: ["startDate"],
        message: "Start date cannot be in the past (Europe/Lisbon).",
      });
    }
    if (val.endDate < val.startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End date cannot be before start date.",
      });
    }
  });

export type ManagerBookingInput = z.infer<typeof ManagerBookingSchema>;