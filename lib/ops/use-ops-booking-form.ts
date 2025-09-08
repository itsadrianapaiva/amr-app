"use client";

import * as React from "react";
import type { DateRange as RDPDateRange, Matcher } from "react-day-picker";

export type MachineOption = { id: number; name: string };

export type DisabledRange = { from: string; to: string };
export type DisabledByMachine = Record<string, DisabledRange[]>;

type Params = {
  minYmd: string;
  /** Values to hydrate defaults on validation errors. */
  values?: Record<string, string>;
  /** Selected machine id when values are absent. */
  machineDefault?: string;
  /** Map of machineId → disabled date ranges (YYYY-MM-DD), from the server. */
  disabledByMachine: DisabledByMachine;
};

const LISBON_TZ = "Europe/Lisbon";

/** Parse 'YYYY-MM-DD' into a Date at 00:00Z (avoids DST off-by-ones). */
function ymdToDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map((n) => parseInt(n, 10));
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

/** Format Date → 'YYYY-MM-DD' in Lisbon wall time for hidden inputs. */
function formatYmdLisbon(d?: Date): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: LISBON_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d); // YYYY-MM-DD
}

/**
 * useOpsBookingForm
 * - Sticky machine selection (values → sessionStorage → default)
 * - RDP date-range state synced from server values
 * - Disabled days: before min date + booked ranges for selected machine
 * - Hidden inputs (startYmd/endYmd) in Lisbon wall time
 */
export function useOpsBookingForm({
  minYmd,
  values,
  machineDefault = "",
  disabledByMachine,
}: Params) {
  // Sticky machine selection
  const [selectedMachineId, setSelectedMachineId] = React.useState<string>("");

  React.useEffect(() => {
    let initial = values?.machineId ?? "";
    if (!initial) {
      try {
        initial = sessionStorage.getItem("ops.selectedMachineId") || "";
      } catch {
        initial = "";
      }
    }
    if (!initial) initial = machineDefault || "";
    setSelectedMachineId(initial);
  }, [values?.machineId, machineDefault]);

  const onChangeMachine = React.useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const v = e.target.value;
      setSelectedMachineId(v);
      try {
        sessionStorage.setItem("ops.selectedMachineId", v);
      } catch {
        /* ignore storage errors (private mode, etc.) */
      }
    },
    []
  );

  // Date range state
  const initialRange: RDPDateRange | undefined = React.useMemo(() => {
    if (values?.startYmd) {
      return {
        from: ymdToDate(values.startYmd),
        to: values?.endYmd ? ymdToDate(values.endYmd) : undefined,
      };
    }
    return undefined;
  }, [values?.startYmd, values?.endYmd]);

  const [range, setRange] = React.useState<RDPDateRange | undefined>(
    initialRange
  );

  // Keep state in sync with server re-hydration
  React.useEffect(() => {
    setRange(initialRange);
  }, [initialRange]);

  // Disabled matchers for the calendar
  const minDate = React.useMemo(() => ymdToDate(minYmd), [minYmd]);

  const disabledDays: Matcher[] = React.useMemo(() => {
    const base: Matcher[] = [{ before: minDate }];
    const key = selectedMachineId ? String(selectedMachineId) : "";
    const ranges: Matcher[] = (disabledByMachine?.[key] || []).map((r) => ({
      from: new Date(r.from),
      to: new Date(r.to),
    }));
    return [...base, ...ranges];
  }, [minDate, selectedMachineId, disabledByMachine]);

  // Hidden input values (Lisbon wall time)
  const startYmdHidden = formatYmdLisbon(range?.from);
  const endYmdHidden = formatYmdLisbon(range?.to);

  return {
    // machine
    selectedMachineId,
    onChangeMachine,

    // calendar
    range,
    setRange,
    disabledDays,

    // hidden fields
    startYmdHidden,
    endYmdHidden,
  };
}
