// Detects "outside service area" root error and derives the contact context (address + dates).
// Keeps booking-form.tsx lean and SOLID by separating concerns.

"use client";

import * as React from "react";
import type { UseFormReturn } from "react-hook-form";
import type { BookingFormValues } from "@/lib/validation/booking";

/** Substring we match in the root error to flag geofence issues (server-owned copy). */
const OUT_OF_AREA_SUBSTRING = "outside our current service area";

export type OutOfAreaInfo = {
  visible: boolean;
  address: string;
  dateFrom: Date | null;
  dateTo: Date | null;
  machineId: number;
};

/**
 * useOutOfAreaInfo
 * - Subscribes to relevant fields via RHF `watch` so the banner updates live.
 * - Builds a compact human-readable address (line1, postalCode, city, country).
 * - Exposes the chosen dates for message prefill.
 */
export function useOutOfAreaInfo(
  form: UseFormReturn<BookingFormValues>,
  machineId: number,
  countryLabel: string = "Portugal"
): OutOfAreaInfo {
  // Detect the geofence error reliably from the server-provided root error message.
  const rootMessage = form.formState.errors.root?.message ?? null;
  const visible = React.useMemo(() => {
    if (typeof rootMessage !== "string") return false;
    return rootMessage.toLowerCase().includes(OUT_OF_AREA_SUBSTRING);
  }, [rootMessage]);

  // Subscribe to address fields so the banner message reflects current inputs.
  const [line1, postalCode, city] = form.watch([
    "siteAddress.line1",
    "siteAddress.postalCode",
    "siteAddress.city",
  ]) as [string | undefined, string | undefined, string | undefined];

  const address = React.useMemo(() => {
    return [line1, postalCode, city, countryLabel].filter(Boolean).join(", ");
  }, [line1, postalCode, city, countryLabel]);

  // Subscribe to date range (best-effort; nulls are fine for prefill)
  const [from, to] = form.watch([
    "dateRange.from",
    "dateRange.to",
  ]) as [Date | null | undefined, Date | null | undefined];

  return {
    visible,
    address,
    dateFrom: from ?? null,
    dateTo: to ?? null,
    machineId,
  };
}
