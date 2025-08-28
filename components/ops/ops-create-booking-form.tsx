"use client";

import * as React from "react";
import type { OpsActionResult } from "@/app/ops/actions";

type MachineOption = { id: number; name: string };
type Props = {
  machines: MachineOption[];
  minYmd: string;
  serverAction: (prev: OpsActionResult | null, formData: FormData) => Promise<OpsActionResult>;
};

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-red-600">{msg}</p>;
}

function SubmitButton() {
  const { pending } = (React as any).useFormStatus?.() ?? { pending: false };
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-6 w-full rounded-md bg-black px-4 py-2 text-white disabled:opacity-60"
    >
      {pending ? "Creating..." : "Create booking"}
    </button>
  );
}

export default function OpsCreateBookingForm({ machines, minYmd, serverAction }: Props) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const [state, formAction] = (React as any).useActionState(serverAction, null as OpsActionResult | null);

  // Reset form after successful booking
  React.useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state?.ok]);

  const fe = (k: string) => (!state?.ok ? state?.fieldErrors?.[k]?.[0] : undefined);

  return (
    <form ref={formRef} action={formAction} className="mx-10 space-y-5">
      {/* Banners */}
      {!state?.ok && state?.formError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {state.formError}
        </div>
      )}
      {state?.ok && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          Booking created.{" "}
          {state.calendar?.htmlLink ? (
            <a className="underline" href={state.calendar.htmlLink} target="_blank" rel="noreferrer">
              Open in Calendar
            </a>
          ) : (
            "Calendar updated."
          )}
        </div>
      )}

      {/* Machine */}
      <div>
        <label htmlFor="machineId" className="block text-sm font-medium">
          Machine
        </label>
        <select
          id="machineId"
          name="machineId"
          required
          className="mt-1 w-full rounded-md border px-3 py-2"
          defaultValue=""
        >
          <option value="" disabled>
            Select a machine…
          </option>
          {machines.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <FieldError msg={fe("machineId")} />
      </div>

      {/* Dates */}
      <div className="grid gap-4 md:grid-cols-2">
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
            className="mt-1 w-full rounded-md border px-3 py-2"
          />
          <FieldError msg={fe("endYmd")} />
        </div>
      </div>

      {/* Names */}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="managerName" className="block text-sm font-medium">
            Manager name
          </label>
          <input id="managerName" name="managerName" required className="mt-1 w-full rounded-md border px-3 py-2" />
          <FieldError msg={fe("managerName")} />
        </div>
        <div>
          <label htmlFor="customerName" className="block text-sm font-medium">
            Customer name (optional)
          </label>
          <input id="customerName" name="customerName" className="mt-1 w-full rounded-md border px-3 py-2" />
          <FieldError msg={fe("customerName")} />
        </div>
      </div>

      {/* Site */}
      <div>
        <label htmlFor="siteAddressLine1" className="block text-sm font-medium">
          Site address
        </label>
        <input
          id="siteAddressLine1"
          name="siteAddressLine1"
          required
          className="mt-1 w-full rounded-md border px-3 py-2"
        />
        <FieldError msg={fe("siteAddressLine1")} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="siteAddressCity" className="block text-sm font-medium">
            City (optional)
          </label>
        </div>
        <input id="siteAddressCity" name="siteAddressCity" className="mt-1 w-full rounded-md border px-3 py-2 md:col-span-1" />
        <div className="md:col-span-2">
          <label htmlFor="siteAddressNotes" className="block text-sm font-medium">
            Notes (optional)
          </label>
          <textarea id="siteAddressNotes" name="siteAddressNotes" rows={2} className="mt-1 w-full rounded-md border px-3 py-2" />
          <FieldError msg={fe("siteAddressNotes")} />
        </div>
      </div>

      {/* Passcode */}
      <div>
        <label htmlFor="opsPasscode" className="block text-sm font-medium">
          Ops passcode
        </label>
        <input id="opsPasscode" name="opsPasscode" type="password" required className="mt-1 w-full rounded-md border px-3 py-2" />
        <FieldError msg={fe("opsPasscode")} />
      </div>

      <SubmitButton />
    </form>
  );
}