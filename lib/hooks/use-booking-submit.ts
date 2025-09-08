// Composes the full-upfront Checkout submit flow with the opt-out gate.
// Small, focused, and reusable across booking forms.

"use client";

import * as React from "react";
import type { UseFormReturn } from "react-hook-form";

import type { BookingFormValues } from "@/lib/validation/booking";
import { createCheckoutAction } from "@/app/actions/create-checkout";
import { useOptOutGate } from "@/lib/hooks/use-optout-gate";

type UseBookingSubmitOpts = {
  form: UseFormReturn<BookingFormValues>;
  machineId: number;

  // Add-on toggles (determine if the opt-out dialog should block submit)
  insuranceOn: boolean;
  deliveryOn: boolean;
  pickupOn: boolean;
  operatorOn: boolean;
};

export function useBookingSubmit(opts: UseBookingSubmitOpts) {
  const { form, machineId, insuranceOn, deliveryOn, pickupOn, operatorOn } =
    opts;

  // Base server submit: creates a PENDING booking and returns the Checkout URL.
  const baseOnSubmit = React.useCallback(
    async (values: BookingFormValues) => {
      const payload = { ...values, machineId };

      try {
        const res: any = await createCheckoutAction(payload);

        if (res?.ok && res.url) {
          // Redirect to Stripe Checkout
          window.location.assign(res.url);
          return;
        }

        // Show a friendly, server-driven error (falls back to availability msg)
        const message =
          res?.formError ??
          "Selected dates are currently unavailable. Please try another range.";
        form.setError("root", { type: "server", message });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Something went wrong creating the checkout.";
        form.setError("root", { type: "server", message });
      }
    },
    [form, machineId]
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
    // Opt-out dialog state + actions
    dialogOpen: gate.dialogOpen,
    setDialogOpen: gate.setDialogOpen,
    missing: gate.missing,
    onConfirm: gate.onConfirm,

    // Submit handler for <form onSubmit={form.handleSubmit(onSubmitAttempt)}>
    onSubmitAttempt,
  };
}
