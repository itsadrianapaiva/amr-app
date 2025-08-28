"use client";

import * as React from "react";
import type { OpsActionResult } from "@/app/ops/actions";
import { useFormStatus } from "react-dom";

// ——— Types ————————————————————————————————————————————————————————————————
type MachineOption = { id: number; name: string };
type Props = {
  machines: MachineOption[];
  minYmd: string;
  serverAction: (
    prev: OpsActionResult | null,
    formData: FormData
  ) => Promise<OpsActionResult>;
};

type CalResult =
  | { ok: true; eventId: string; htmlLink?: string }
  | { ok: false; formError: string };

// ——— UI bits ————————————————————————————————————————————————————————————————
function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-red-600">{msg}</p>;
}

function Banner({
  kind,
  children,
}: {
  kind: "success" | "error" | "warn" | "info";
  children: React.ReactNode;
}) {
  const styles =
    kind === "success"
      ? "bg-green-50 text-green-900 border-green-200"
      : kind === "error"
      ? "bg-red-50 text-red-900 border-red-200"
      : kind === "warn"
      ? "bg-yellow-50 text-yellow-900 border-yellow-200"
      : "bg-blue-50 text-blue-900 border-blue-200";
  return (
    <div className={`mb-4 rounded-md border px-4 py-3 ${styles}`}>
      {children}
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center rounded-md bg-black px-4 py-2 text-white disabled:opacity-60"
    >
      {pending ? "Saving…" : "Create booking"}
    </button>
  );
}

// ——— Small helpers ————————————————————————————————————————————————
async function postCalendar(
  payload: Record<string, string>
): Promise<CalResult> {
  try {
    const res = await fetch("/api/ops/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as CalResult;
    if (!data || typeof data.ok !== "boolean") {
      return { ok: false, formError: "Calendar response malformed" };
    }
    return data;
  } catch (e: any) {
    return { ok: false, formError: e?.message || "Calendar request failed" };
  }
}

// ——— Main component ————————————————————————————————————————————————
export default function OpsCreateBookingForm({
  machines,
  minYmd,
  serverAction,
}: Props) {
  const [state, formAction] = (React as any).useActionState(
    serverAction,
    null as OpsActionResult | null
  );

  // Banners anchor
  const resultRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (state)
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [state]);

  // Persist values on error
  const values = (!state?.ok ? state?.values : undefined) as
    | Record<string, string>
    | undefined;
  const machineDefault = values?.machineId ?? "";

  // Form ref for standard action
  const formRef = React.useRef<HTMLFormElement>(null);

  // NEW: snapshot the submission before RSC re-render can clear anything
  const lastSubmissionRef = React.useRef<Record<string, string> | null>(null);
  const onSubmitCapture = React.useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      // Build a plain object snapshot from the current form fields
      const fd = new FormData(e.currentTarget);
      lastSubmissionRef.current = {
        machineId: String(fd.get("machineId") || ""),
        startYmd: String(fd.get("startYmd") || ""),
        endYmd: String(fd.get("endYmd") || ""),
        managerName: String(fd.get("managerName") || ""),
        customerName: String(fd.get("customerName") || ""),
        siteAddressLine1: String(fd.get("siteAddressLine1") || ""),
        siteAddressCity: String(fd.get("siteAddressCity") || ""),
        siteAddressNotes: String(fd.get("siteAddressNotes") || ""),
      };
    },
    []
  );

  // Calendar side-effect status (best effort)
  const [calStatus, setCalStatus] = React.useState<
    "idle" | "pending" | "ok" | "error"
  >("idle");
  const [calLink, setCalLink] = React.useState<string | undefined>(undefined);
  const [calError, setCalError] = React.useState<string | undefined>(undefined);

  // After a successful booking, call Calendar with the SNAPSHOT, not the DOM
  React.useEffect(() => {
    if (!state?.ok) return;

    const snap = lastSubmissionRef.current;
    if (!snap) {
      setCalStatus("error");
      setCalError("Calendar payload missing (no snapshot).");
      return;
    }

    // Guard required fields to avoid zod "Invalid input"
    const required = [
      "machineId",
      "startYmd",
      "endYmd",
      "managerName",
      "siteAddressLine1",
    ] as const;
    for (const k of required) {
      if (!snap[k] || String(snap[k]).trim() === "") {
        setCalStatus("error");
        setCalError(`Calendar payload missing field: ${k}`);
        return;
      }
    }

    setCalStatus("pending");
    setCalError(undefined);
    setCalLink(undefined);

    const payload = {
      bookingId: state.bookingId,
      ...snap, // machineId, dates, names, site fields
    };

    postCalendar(payload).then((res) => {
      if (res.ok) {
        setCalStatus("ok");
        setCalLink(res.htmlLink);
      } else {
        setCalStatus("error");
        setCalError(res.formError);
      }
    });
  }, [state?.ok]);

  // Helper to surface first field error
  const fe = (k: string) =>
    !state?.ok ? state?.fieldErrors?.[k]?.[0] : undefined;

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={onSubmitCapture}
      className="mx-10 space-y-5"
    >
      {/* Result banners */}
      <div ref={resultRef}>
        {!state?.ok && state?.formError && (
          <Banner kind="error">{state.formError}</Banner>
        )}

        {state?.ok && (
          <Banner kind="success">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-medium">Booking created successfully.</span>

              {calStatus === "pending" && (
                <span className="text-xs opacity-80">
                  Adding to Google Calendar…
                </span>
              )}

              {calStatus === "ok" && calLink && (
                <a
                  className="inline-flex shrink-0 rounded-md border px-3 py-1 text-xs underline"
                  href={calLink}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in Calendar
                </a>
              )}

              {calStatus === "error" && (
                <span className="text-xs text-red-700">
                  Calendar update failed: {calError ?? "Unknown error"} (booking
                  saved)
                </span>
              )}
            </div>
          </Banner>
        )}
      </div>

      {/* Machine */}
      <div>
        <label htmlFor="machineId" className="block text-sm font-medium">
          Machine
        </label>
        <select
          key={machineDefault}
          id="machineId"
          name="machineId"
          required
          defaultValue={machineDefault}
          className="mt-1 w-full rounded-md border px-3 py-2"
        >
          <option value="" disabled>
            Select a machine
          </option>
          {machines.map((m) => (
            <option key={m.id} value={String(m.id)}>
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
      <div>
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

      <div className="grid gap-4 md:grid-cols-2">
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
          <textarea
            id="siteAddressNotes"
            name="siteAddressNotes"
            rows={2}
            defaultValue={values?.siteAddressNotes ?? ""}
            className="mt-1 w-full rounded-md border px-3 py-2"
          />
          <FieldError msg={fe("siteAddressNotes")} />
        </div>
      </div>

      {/* Passcode */}
      <div>
        <label htmlFor="opsPasscode" className="block text-sm font-medium">
          Manager passcode
        </label>
        <input
          id="opsPasscode"
          name="opsPasscode"
          type="password"
          autoComplete="off"
          defaultValue=""
          required
          className="mt-1 w-full rounded-md border px-3 py-2"
        />
        <FieldError msg={fe("opsPasscode")} />
      </div>

      <SubmitButton />
    </form>
  );
}
