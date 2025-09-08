"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import type { OpsActionResult } from "@/app/ops/actions";
import OpsBookingFields from "@/components/ops/ops-booking-fields";
import type { MachineOption } from "@/lib/ops/use-ops-booking-form";
import ErrorSummary from "../forms/error-summary";

type DisabledRange = { from: string; to: string };
type DisabledByMachine = Record<string, DisabledRange[]>;

type Props = {
  machines: MachineOption[];
  minYmd: string;
  serverAction: (
    prev: OpsActionResult | null,
    formData: FormData
  ) => Promise<OpsActionResult>;
  /** Map of machineId → disabled date ranges (YYYY-MM-DD), from the server */
  disabledByMachine: DisabledByMachine;
};

export default function OpsCreateBookingForm({
  machines,
  minYmd,
  serverAction,
  disabledByMachine,
}: Props) {
  const router = useRouter();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [state, formAction] = (React as any).useActionState(
    serverAction,
    null as OpsActionResult | null
  );

  const values = (!state?.ok ? state?.values : undefined) as
    | Record<string, string>
    | undefined;
  const machineDefault = values?.machineId ?? "";

  const fe = React.useCallback(
    (k: string) => (!state?.ok ? state?.fieldErrors?.[k]?.[0] : undefined),
    [state]
  );

  // On success: clear sticky selection, then navigate to success page.
  const navigatedRef = React.useRef(false);
  React.useEffect(() => {
    if (state?.ok && !navigatedRef.current) {
      navigatedRef.current = true;
      try {
        sessionStorage.removeItem("ops.selectedMachineId");
      } catch {
        /* ignore storage errors */
      }
      router.push(
        `/ops/success?bookingId=${encodeURIComponent(state.bookingId)}`
      );
    }
  }, [state?.ok, state?.bookingId, router]);

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {state?.ok === false && (
        <ErrorSummary
          show={state?.ok === false}
          message={state?.formError || "Please fix the errors and try again."}
          kind="error"
          className="mx-10"
        />
      )}

      <OpsBookingFields
        machines={machines}
        minYmd={minYmd}
        values={values}
        machineDefault={machineDefault}
        fe={fe}
        disabledByMachine={disabledByMachine}
      />

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mx-10 inline-flex items-center rounded-md bg-black px-4 py-2 text-white disabled:opacity-60"
      aria-disabled={pending}
    >
      {pending ? "Saving…" : "Create booking"}
    </button>
  );
}
