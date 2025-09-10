"use client";

import * as React from "react";
import OpsBookingFields from "@/components/ops/ops-booking-fields";
import type {
  MachineOption,
  DisabledByMachine,
} from "@/lib/ops/use-ops-booking-form";
import { createOpsBookingAction } from "@/app/ops/actions";
import { useFormStatus, useFormState } from "react-dom";
import type { OpsActionResult } from "@/app/ops/actions";
import ErrorSummary from "@/components/forms/error-summary";
import { useRouter } from "next/navigation";

type Props = {
  machineOptions: MachineOption[];
  minYmd: string;
  disabledByMachine: DisabledByMachine;
  values?: Record<string, string>;
  machineDefault?: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mx-10 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
    >
      {pending ? "Creating…" : "Create booking"}
    </button>
  );
}

export default function OpsCreateBookingForm({
  machineOptions,
  minYmd,
  disabledByMachine,
  values,
  machineDefault,
}: Props) {
  const initialState: OpsActionResult = {
    ok: false,
    formError: undefined,
    fieldErrors: undefined,
    values: values ?? {},
  };

  // Bind the Server Action
  const [state, action] = useFormState(createOpsBookingAction, initialState);

  // ---- Union-narrowing: extras only exist when ok === false ----
  const formError = state.ok ? undefined : state.formError;
  const fieldErrors = state.ok ? undefined : state.fieldErrors;
  const hydratedValues = state.ok ? values : (state.values ?? values);

  const fe = React.useCallback(
    (k: string) => fieldErrors?.[k]?.[0] as string | undefined,
    [fieldErrors]
  );

  //  Refresh the RSC boundary on a FAILED submit so disabled ranges update immediately
  const router = useRouter();
  const submittedRef = React.useRef(false);

  React.useEffect(() => {
    if (!submittedRef.current) return; // only after an actual submit
    if (!state.ok && !!formError) {
      submittedRef.current = false; // reset the edge-trigger
      router.refresh(); // re-fetch /ops (server data + disabled ranges)
    }
  }, [state.ok, formError, router]);

  return (
    <form
      action={action}
      className="space-y-8"
      onSubmit={() => {
        submittedRef.current = true;
      }}
    >
      <OpsBookingFields
        machines={machineOptions}
        minYmd={minYmd}
        values={hydratedValues}
        machineDefault={machineDefault}
        disabledByMachine={disabledByMachine}
        fe={fe}
      />

      <ErrorSummary
        id="ops-error-summary"
        className="mx-10"
        kind="error"
        show={!state.ok && !!formError}
        message={formError ?? undefined}
      />

      <div className="mt-6">
        <SubmitButton />
      </div>
    </form>
  );
}
