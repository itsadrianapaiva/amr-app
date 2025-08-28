import { z } from "zod";

/** YYYY-MM-DD guard for day-precision ops bookings. */
const YMD = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

/** Convert YYYY-MM-DD to a UTC Date object for strict comparisons. */
function ymdToUtcDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Optional trimmed text: returns undefined for empty strings. */
const optionalText = (min = 2) =>
  z
    .union([z.string().trim().min(min), z.literal("")])
    .optional()
    .transform((v) => (v ? (v as string).trim() : undefined));

/**
 * ManagerOpsSchema
 * Minimal fields for internal ops bookings.
 * Names are aligned with the /ops form and action.
 */
export const ManagerOpsSchema = z
  .object({
    opsPasscode: z.string().min(1, "Passcode is required"),

    machineId: z.coerce.number().int().positive("Select a machine"),

    startYmd: YMD,
    endYmd: YMD,

    managerName: z.string().trim().min(2, "Manager name is required"),
    customerName: optionalText(2),

    siteAddressLine1: z.string().trim().min(2, "Site address is required"),
    siteAddressCity: optionalText(2),
    siteAddressNotes: optionalText(1),
  })
  .superRefine((val, ctx) => {
    const start = ymdToUtcDate(val.startYmd);
    const end = ymdToUtcDate(val.endYmd);
    if (!(start < end)) {
      ctx.addIssue({
        code: "custom",
        path: ["endYmd"],
        message: "End date must be after start date",
      });
    }
  });

export type ManagerOpsInput = z.infer<typeof ManagerOpsSchema>;
