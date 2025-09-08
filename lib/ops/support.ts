// Small, focused helpers for /ops: dates, zod errors, overlap checks, and lead-time notes.

import { validateLeadTimeLisbon } from "@/lib/logistics/lead-time";
import type { ZodFormattedError } from "zod";

//  Heavy-transport policy (MVP)
export const HEAVY_MACHINE_IDS = new Set<number>([5, 6, 7]);
export const LEAD_DAYS = 2;
export const CUTOFF_HOUR = 15;

// Convert YYYY-MM-DD to a UTC Date (00:00Z) for consistent comparisons.
export function ymdToUtcDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

// Format a Date in Lisbon time as "DD Mon, HH:MM" (24h).
export function formatLisbon(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Lisbon",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

// Postgres/Prisma overlap guard recognizer (message-based).
export function isOverlapError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  const lower = msg.toLowerCase();
  return (
    msg.includes("booking_no_overlap_for_active") ||
    lower.includes("exclusion") ||
    lower.includes("overlap")
  );
}

// Map Zod's formatted error → { fieldErrors, formError }.
export function mapZodErrors(
  formatted: ZodFormattedError<unknown>
): { fieldErrors: Record<string, string[]>; formError?: string } {
  const fieldErrors: Record<string, string[]> = {};
  for (const key of Object.keys(formatted)) {
    if (key === "_errors") continue;
    const entry = (formatted as Record<string, unknown>)[key] as
      | { _errors?: string[] }
      | undefined;
    if (entry?._errors?.length) fieldErrors[key] = entry._errors;
  }
  const formError = formatted._errors?.[0];
  return { fieldErrors, formError };
}

// If heavy-transport violates lead-time, produce an OPS override note; else null.
export function leadTimeOverrideNoteIfAny(
  machineId: number,
  start: Date
): string | null {
  if (!HEAVY_MACHINE_IDS.has(machineId)) return null;

  const { ok, earliestAllowedDay } = validateLeadTimeLisbon({
    startDate: start,
    leadDays: LEAD_DAYS,
    cutoffHour: CUTOFF_HOUR,
  });
  if (ok) return null;

  const friendly = earliestAllowedDay.toLocaleDateString("en-GB", {
    timeZone: "Europe/Lisbon",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const stamp = new Date().toLocaleString("en-GB", { timeZone: "Europe/Lisbon" });
  return `[OPS OVERRIDE] Heavy-transport lead time bypassed on ${stamp}. Earliest allowed was ${friendly}.`;
}
