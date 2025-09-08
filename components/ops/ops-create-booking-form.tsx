"use client";

import * as React from "react";
import OpsBookingFields from "@/components/ops/ops-booking-fields";
import type {
  MachineOption,
  DisabledByMachine,
} from "@/lib/ops/use-ops-booking-form";
import { createOpsBookingAction } from "@/app/ops/actions";
import { useFormStatus } from "react-dom";

/**
 * Props for the Ops create form.
 */
type Props = {
  machineOptions: MachineOption[];
  minYmd: string;
  disabledByMachine: DisabledByMachine;
  values?: Record<string, string>;
  machineDefault?: string;
};

/** Submit button with pending state via useFormStatus (React 18+ with Next). */
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
  /**
   * Client wrapper matching <form action> expected type:
   * (formData) => Promise<void>
   * Calls the server action that has the (prev, formData) signature.
   */
  async function submit(formData: FormData): Promise<void> {
    await createOpsBookingAction(undefined, formData);
    // The server action handles redirect/success; nothing to return here.
  }

  return (
    <form action={submit} className="space-y-8">
      <OpsBookingFields
        machines={machineOptions}
        minYmd={minYmd}
        values={values}
        machineDefault={machineDefault}
        disabledByMachine={disabledByMachine}
        fe={() => undefined}
      />

      <div className="mt-6">
        <SubmitButton />
      </div>
    </form>
  );
}
