"use client";

import * as React from "react";
import type { UseFormReturn } from "react-hook-form";

import type { BookingFormValues } from "@/lib/validation/booking";
import { createCheckoutAction } from "@/app/actions/create-checkout";
import { useOptOutGate } from "@/lib/hooks/use-optout-gate";
import { trackGaBeginCheckout } from "@/components/analytics/ga4-clicking";
import { metaInitiateCheckout } from "@/lib/analytics/metaEvents";

type UseBookingSubmitOpts = {
  form: UseFormReturn<BookingFormValues>;
  machineId: number;
  machineName?: string;

  // Add-on toggles (determine if the opt-out dialog should block submit)
  insuranceOn: boolean;
  deliveryOn: boolean;
  pickupOn: boolean;
  operatorOn: boolean;
};

// Discriminated union expected from the server action
type CreateCheckoutResult =
  | { ok: true; url: string }
  | { ok: false; formError?: string };

// Runtime guard to narrow unknown → CreateCheckoutResult
function isCreateCheckoutResult(x: unknown): x is CreateCheckoutResult {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  if (typeof r.ok !== "boolean") return false;
  if (r.ok === true) return typeof r.url === "string";
  return r.formError === undefined || typeof r.formError === "string";
}

export function useBookingSubmit(opts: UseBookingSubmitOpts) {
  const { form, machineId, machineName, insuranceOn, deliveryOn, pickupOn, operatorOn } =
    opts;

  // Idempotency guard to prevent duplicate analytics events within the same page session
  const beganCheckoutRef = React.useRef<boolean>(false);

  // Base server submit: creates a PENDING booking and returns the Checkout URL.
  const baseOnSubmit = React.useCallback(
    async (values: BookingFormValues) => {
      const payload = { ...values, machineId };

      try {
        const unknownRes: unknown = await createCheckoutAction(payload);

        if (isCreateCheckoutResult(unknownRes)) {
          if (unknownRes.ok) {
            // Fire begin_checkout analytics exactly once before redirecting to Stripe
            if (!beganCheckoutRef.current) {
              beganCheckoutRef.current = true;
              trackGaBeginCheckout({
                machine_id: machineId,
                machine_name: machineName,
              });
              metaInitiateCheckout({
                machineId,
                machineName: machineName || "Selected machine",
              });
            }

            window.location.assign(unknownRes.url);
            return;
          }
          const message =
            unknownRes.formError ??
            "Selected dates are currently unavailable. Please try another range.";
          form.setError("root", { type: "server", message });
          return;
        }

        // Unexpected payload shape
        form.setError("root", {
          type: "server",
          message:
            "We couldn't start the checkout. Please refresh and try again.",
        });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Something went wrong creating the checkout.";
        form.setError("root", { type: "server", message });
      }
    },
    [form, machineId, machineName]
  );

  // Gate submit if user opted out of add-ons the business expects.
  const gate = useOptOutGate({
    insuranceOn,
    deliveryOn,
    pickupOn,
    operatorOn,
    onProceed: baseOnSubmit,
  });

  // RHF-compatible submit handler that invokes the gated flow
  const onSubmitAttempt = React.useCallback(
    (values: BookingFormValues) => gate.onSubmitAttempt(values),
    [gate]
  );

  return {
    dialogOpen: gate.dialogOpen,
    setDialogOpen: gate.setDialogOpen,
    missing: gate.missing,
    onConfirm: gate.onConfirm,
    onSubmitAttempt,
  };
}
