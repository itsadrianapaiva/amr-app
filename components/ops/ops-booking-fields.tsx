"use client";

import * as React from "react";
import { DateRangeInput } from "../booking/date-range-input";
import type { Matcher, DateRange as RDPDateRange } from "react-day-picker";

import {
  useOpsBookingForm,
  type DisabledByMachine,
  type MachineOption,
} from "@/lib/ops/use-ops-booking-form";

type Props = {
  machines: MachineOption[];
  minYmd: string;
  /** Values to hydrate defaultValue for sticky UX on validation errors. */
  values?: Record<string, string>;
  /** Selected machine id when values are absent. */
  machineDefault?: string;
  /** First field error by key, supplied by the container/hook. */
  fe: (k: string) => string | undefined;
  /** Map of machineId → disabled date ranges (YYYY-MM-DD), from the server */
  disabledByMachine: DisabledByMachine;
};

export default function OpsBookingFields({
  machines,
  minYmd,
  values,
  machineDefault = "",
  fe,
  disabledByMachine,
}: Props) {
  // All state + derived values live in the hook (keeps component dumb & lean)
  const {
    selectedMachineId,
    onChangeMachine,
    range,
    setRange,
    disabledDays,
    startYmdHidden,
    endYmdHidden,
  } = useOpsBookingForm({ minYmd, values, machineDefault, disabledByMachine });

  return (
    <>
      {/* Machine + Dates */}
      <div className="grid gap-4 md:grid-cols-3 mx-10">
        <div>
          <label htmlFor="machineId" className="block text-sm font-medium">
            Machine
          </label>
          <select
            id="machineId"
            name="machineId"
            required
            value={selectedMachineId}
            onChange={onChangeMachine}
            className="mt-1 w-full rounded-md border px-3 py-2"
          >
            <option value="" disabled>
              Select a machine
            </option>
            {machines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <FieldError msg={fe("machineId")} />
        </div>

        {/* Shared DateRangeInput (spans two columns on md+) */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium">Rental dates</label>
          <div className="mt-1">
            <DateRangeInput
              value={range as unknown as RDPDateRange}
              onChange={(next) => setRange(next as RDPDateRange | undefined)}
              disabledDays={disabledDays as Matcher[]}
            />
          </div>

          {/* Hidden inputs to keep the existing server action contract unchanged */}
          <input type="hidden" name="startYmd" value={startYmdHidden} />
          <input type="hidden" name="endYmd" value={endYmdHidden} />

          {/* Inline server-side validation feedback */}
          <div className="mt-1 grid gap-1">
            <FieldError msg={fe("startYmd")} />
            <FieldError msg={fe("endYmd")} />
          </div>

          {/* Helper text / policy hint */}
          <p className="mt-1 text-xs text-gray-600">
            Earliest start: tomorrow. Blocked dates are grayed out.
          </p>
        </div>
      </div>

      {/* Manager + Customer */}
      <div className="grid gap-4 md:grid-cols-2 mx-10">
        <div>
          <label htmlFor="managerName" className="block text-sm font-medium">
            Manager name
          </label>
          <input
            id="managerName"
            name="managerName"
            required
            defaultValue={values?.managerName ?? ""}
            className="mt-1 w-full rounded-md border px-3 py-2"
          />
          <FieldError msg={fe("managerName")} />
        </div>

        <div>
          <label htmlFor="customerName" className="block text-sm font-medium">
            Customer name (optional)
          </label>
          <input
            id="customerName"
            name="customerName"
            defaultValue={values?.customerName ?? ""}
            className="mt-1 w-full rounded-md border px-3 py-2"
          />
          <FieldError msg={fe("customerName")} />
        </div>
      </div>

      {/* Site */}
      <div className="mx-10">
        <label htmlFor="siteAddressLine1" className="block text-sm font-medium">
          Site address
        </label>
        <input
          id="siteAddressLine1"
          name="siteAddressLine1"
          required
          defaultValue={values?.siteAddressLine1 ?? ""}
          className="mt-1 w-full rounded-md border px-3 py-2"
        />
        <FieldError msg={fe("siteAddressLine1")} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 mx-10">
        <div>
          <label
            htmlFor="siteAddressCity"
            className="block text-sm font-medium"
          >
            City (optional)
          </label>
          <input
            id="siteAddressCity"
            name="siteAddressCity"
            defaultValue={values?.siteAddressCity ?? ""}
            className="mt-1 w-full rounded-md border px-3 py-2"
          />
          <FieldError msg={fe("siteAddressCity")} />
        </div>

        <div>
          <label
            htmlFor="siteAddressNotes"
            className="block text-sm font-medium"
          >
            Notes (optional)
          </label>
          <input
            id="siteAddressNotes"
            name="siteAddressNotes"
            defaultValue={values?.siteAddressNotes ?? ""}
            className="mt-1 w-full rounded-md border px-3 py-2"
          />
          <FieldError msg={fe("siteAddressNotes")} />
        </div>
      </div>

      {/* Ops passcode (never echoed back by design) */}
      <div className="mx-10">
        <label htmlFor="opsPasscode" className="block text-sm font-medium">
          Ops passcode
        </label>
        <input
          id="opsPasscode"
          name="opsPasscode"
          type="password"
          className="mt-1 w-full rounded-md border px-3 py-2"
        />
        <FieldError msg={fe("opsPasscode")} />
      </div>
    </>
  );
}

/** Tiny local helper to keep the component dumb and reusable. */
function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-sm text-red-600">{msg}</p>;
}
