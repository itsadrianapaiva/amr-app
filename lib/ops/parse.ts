import "server-only";

import { ManagerOpsSchema } from "@/lib/validation/manager-booking";
import { mapZodErrors, ymdToUtcDate } from "@/lib/ops/support";

/** Raw string fields we collect from the form. */
export type OpsRawFields = {
  opsPasscode: string;
  machineId: string;
  startYmd: string;
  endYmd: string;
  managerName: string;
  customerName: string;
  siteAddressLine1: string;
  siteAddressCity: string;
  siteAddressNotes: string;
};

/** Typed, normalized payload the service layer expects. */
export type OpsParsedData = {
  /** Keep passcode here; the action will validate it against env. */
  opsPasscode: string;

  machineId: number;
  start: Date;
  end: Date;

  managerName: string;
  customerName?: string;
  siteAddressLine1: string;
  siteAddressCity?: string | null;
  siteAddressNotes?: string | null;
};

export type OpsParseOk = { ok: true; data: OpsParsedData; raw: OpsRawFields };
export type OpsParseErr = {
  ok: false;
  formError?: string;
  fieldErrors?: Record<string, string[]>;
  /** Values to echo back on the form (opsPasscode intentionally blank). */
  values: Record<string, string>;
};
export type OpsParseResult = OpsParseOk | OpsParseErr;

/** Read only the fields we care about from FormData, as strings. */
function readForm(formData: FormData): OpsRawFields {
  const read = (k: string) => String(formData.get(k) ?? "");
  return {
    opsPasscode: read("opsPasscode"),
    machineId: read("machineId"),
    startYmd: read("startYmd"),
    endYmd: read("endYmd"),
    managerName: read("managerName"),
    customerName: read("customerName"),
    siteAddressLine1: read("siteAddressLine1"),
    siteAddressCity: read("siteAddressCity"),
    siteAddressNotes: read("siteAddressNotes"),
  };
}

/**
 * Parse & validate /ops booking form.
 * - Zod-validates using ManagerOpsSchema (string-level schema)
 * - Normalizes machineId (number) and dates (UTC 00:00 via ymdToUtcDate)
 * - On error, returns shape ready for UI (with passcode blanked)
 */
export async function parseOpsForm(
  formData: FormData
): Promise<OpsParseResult> {
  const raw = readForm(formData);

  // 1) Validate with Zod (string schema)
  const parsed = ManagerOpsSchema.safeParse(raw);
  if (!parsed.success) {
    const formatted = parsed.error.format((issue) => `Error: ${issue.message}`);
    const { fieldErrors, formError } = mapZodErrors(formatted);
    return {
      ok: false,
      fieldErrors,
      formError,
      values: { ...raw, opsPasscode: "" },
    };
  }
  const input = parsed.data;

  // 2) Normalize machine id
  const machineId = Number(input.machineId);
  if (!Number.isInteger(machineId) || machineId <= 0) {
    return {
      ok: false,
      formError: "Invalid machine id.",
      values: { ...raw, opsPasscode: "" },
    };
  }

  // 3) Normalize dates to stable UTC (00:00Z) for inclusive range comparisons
  const start = ymdToUtcDate(input.startYmd);
  const end = ymdToUtcDate(input.endYmd);

  // 4) Build typed DTO for the service layer
  const data: OpsParsedData = {
    opsPasscode: input.opsPasscode,
    machineId,
    start,
    end,
    managerName: input.managerName,
    customerName: input.customerName || undefined,
    siteAddressLine1: input.siteAddressLine1,
    siteAddressCity: input.siteAddressCity || null,
    siteAddressNotes: input.siteAddressNotes || null,
  };

  return { ok: true, data, raw };
}
