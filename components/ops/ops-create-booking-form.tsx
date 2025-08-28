"use client";

import * as React from "react";
import type { OpsActionResult } from "@/app/ops/actions";
import { useFormStatus } from "react-dom";

type MachineOption = { id: number; name: string };
type Props = {
  machines: MachineOption[];
  minYmd: string;
  serverAction: (
    prev: OpsActionResult | null,
    formData: FormData
  ) => Promise<OpsActionResult>;
};

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-red-600">{msg}</p>;
}

function SubmitButton() {
  const { pending } = useFormStatus();
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

function Banner({
  kind,
  children,
}: {
  kind: "success" | "error" | "warn";
  children: React.ReactNode;
}) {
  const styles =
    kind === "success"
      ? "border-green-200 bg-green-50 text-green-800"
      : kind === "warn"
      ? "border-yellow-200 bg-yellow-50 text-yellow-800"
      : "border-red-200 bg-red-50 text-red-700";
  return (
    <div
      className={`rounded-md border p-3 text-sm ${styles}`}
      role={kind === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      {children}
    </div>
  );
}

export default function OpsCreateBookingForm({
  machines,
  minYmd,
  serverAction,
}: Props) {
  const [state, formAction] = (React as any).useActionState(
    serverAction,
    null as OpsActionResult | null
  );

  // Scroll banners into view after submit
  const resultRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (state) {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [state]);

  // Helpers to repopulate values when ok:false (action echoes values)
  const values = (!state?.ok ? state?.values : undefined) as
    | Partial<Record<string, string>>
    | undefined;
  const v = (k: string) => values?.[k] ?? "";

  // Helper to surface first field error
  const fe = (k: string) =>
    !state?.ok ? state?.fieldErrors?.[k]?.[0] : undefined;

  return (
    <form action={formAction} className="mx-10 space-y-5">
      {/* Result banners */}
      <div ref={resultRef}>
        {!state?.ok && state?.formError && (
          <Banner kind="error">{state.formError}</Banner>
        )}
        {state?.ok && (
          <Banner kind="success">
            <div className="flex items-center justify-between gap-4">
              <span className="font-medium">Booking created successfully.</span>
              {state.calendar?.htmlLink ? (
                <a
                  className="inline-flex shrink-0 rounded-md border px-3 py-1 text-xs underline"
                  href={state.calendar.htmlLink}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in Calendar
                </a>
              ) : (
                <span className="text-xs opacity-80">Calendar updated.</span>
              )}
            </div>
          </Banner>
        )}
        {state?.ok && state.calendarError && (
          <Banner kind="warn">{state.calendarError}</Banner>
        )}
      </div>

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
          defaultValue={v("machineId")}
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
            defaultValue={v("startYmd")}
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
            defaultValue={v("endYmd")}
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
          <input
            id="managerName"
            name="managerName"
            required
            defaultValue={v("managerName")}
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
            defaultValue={v("customerName")}
            className="mt-1 w-full rounded-md border px-3 py-2"
          />
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
          defaultValue={v("siteAddressLine1")}
          className="mt-1 w-full rounded-md border px-3 py-2"
        />
        <FieldError msg={fe("siteAddressLine1")} />
      </div>
      <div>
        <label htmlFor="siteAddressCity" className="block text-sm font-medium">
          City (optional)
        </label>
        <input
          id="siteAddressCity"
          name="siteAddressCity"
          defaultValue={v("siteAddressCity")}
          className="mt-1 w-full rounded-md border px-3 py-2"
        />
        <FieldError msg={fe("siteAddressCity")} />
      </div>
      <div>
        <label htmlFor="siteAddressNotes" className="block text-sm font-medium">
          Notes (optional)
        </label>
        <textarea
          id="siteAddressNotes"
          name="siteAddressNotes"
          rows={2}
          defaultValue={v("siteAddressNotes")}
          className="mt-1 w-full rounded-md border px-3 py-2"
        />
        <FieldError msg={fe("siteAddressNotes")} />
      </div>

      {/* Passcode */}
      <div>
        <label htmlFor="opsPasscode" className="block text-sm font-medium">
          Ops passcode
        </label>
        <input
          id="opsPasscode"
          name="opsPasscode"
          type="password"
          required
          className="mt-1 w-full rounded-md border px-3 py-2"
        />
        <FieldError msg={fe("opsPasscode")} />
      </div>

      <SubmitButton />
    </form>
  );
}
