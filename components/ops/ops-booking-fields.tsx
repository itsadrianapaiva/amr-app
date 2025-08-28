"use client";

import * as React from "react";

export type MachineOption = { id: number; name: string };

type Props = {
  machines: MachineOption[];
  minYmd: string;
  /** Values to hydrate defaultValue for sticky UX on validation errors. */
  values?: Record<string, string>;
  /** Selected machine id when values are absent. */
  machineDefault?: string;
  /** First field error by key, supplied by the container/hook. */
  fe: (k: string) => string | undefined;
};

/**
 * OpsBookingFields
 * Pure presentational form sections for the /ops booking form.
 * No local state. No side-effects. Controlled entirely via props.
 */
export default function OpsBookingFields({
  machines,
  minYmd,
  values,
  machineDefault = "",
  fe,
}: Props) {
  // Sticky machine selection (persists across validation errors)
  const [selectedMachineId, setSelectedMachineId] = React.useState<string>("");

  // Initialize from (1) server-provided values, (2) sessionStorage, (3) prop default.
  React.useEffect(() => {
    let initial = values?.machineId ?? "";
    if (!initial) {
      try {
        initial = sessionStorage.getItem("ops.selectedMachineId") || "";
      } catch {
        initial = "";
      }
    }
    if (!initial) {
      initial = machineDefault || "";
    }
    setSelectedMachineId(initial);
  }, [values?.machineId, machineDefault]);

  const onChangeMachine = React.useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const v = e.target.value;
      setSelectedMachineId(v);
      try {
        sessionStorage.setItem("ops.selectedMachineId", v);
      } catch {
        /* ignore storage errors (e.g., private mode) */
      }
    },
    []
  );

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

        <div>
          <label htmlFor="startYmd" className="block text-sm font-medium">
            Start date
          </label>
          <input
            id="startYmd"
            name="startYmd"
            type="date"
            min={minYmd}
            required
            defaultValue={values?.startYmd ?? ""}
            className="mt-1 w-full rounded-md border px-3 py-2"
          />
          <FieldError msg={fe("startYmd")} />
        </div>

        <div>
          <label htmlFor="endYmd" className="block text-sm font-medium">
            End date
          </label>
          <input
            id="endYmd"
            name="endYmd"
            type="date"
            min={minYmd}
            required
            defaultValue={values?.endYmd ?? ""}
            className="mt-1 w-full rounded-md border px-3 py-2"
          />
          <FieldError msg={fe("endYmd")} />
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
