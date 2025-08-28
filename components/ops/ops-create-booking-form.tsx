"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import type { OpsActionResult } from "@/app/ops/actions";
import OpsBookingFields, {
  type MachineOption,
} from "@/components/ops/ops-booking-fields";

type Props = {
  machines: MachineOption[];
  minYmd: string;
  serverAction: (
    prev: OpsActionResult | null,
    formData: FormData
  ) => Promise<OpsActionResult>;
};

export default function OpsCreateBookingForm({
  machines,
  minYmd,
  serverAction,
}: Props) {
  const router = useRouter();

  // Bind to the server action directly; initial state is null and never throws.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [state, formAction] = (React as any).useActionState(
    serverAction,
    null as OpsActionResult | null
  );

  // Sticky values for defaultValue hydration when validation fails.
  const values = (!state?.ok ? state?.values : undefined) as
    | Record<string, string>
    | undefined;
  const machineDefault = values?.machineId ?? "";

  // Tiny helper: first field error by key.
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
      {/* Only error banner remains; success navigates away */}
      {state?.ok === false && (
        <Banner kind="error">
          {state.formError || "Please fix the errors and try again."}
        </Banner>
      )}

      <OpsBookingFields
        machines={machines}
        minYmd={minYmd}
        values={values}
        machineDefault={machineDefault}
        fe={fe}
      />

      <SubmitButton />
    </form>
  );
}

/* ——— Presentational helpers kept local to the container ——— */

function Banner({
  kind,
  children,
}: {
  kind: "success" | "error";
  children: React.ReactNode;
}) {
  const cls =
    kind === "success"
      ? "rounded-md bg-green-50 border border-green-200 text-green-900 px-3 py-2"
      : "rounded-md bg-red-50 border border-red-200 text-red-900 px-3 py-2";
  return <div className={cls}>{children}</div>;
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
