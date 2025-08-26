"use client";

import * as React from "react";
import type { BookingFormValues } from "@/lib/validation/booking";

/**
 * Local structural type; matches the AlertDialog's needs without coupling
 * this hook to presentation-layer imports.
 */
type MissingAddOns = {
  insurance: boolean;
  delivery: boolean;
  pickup: boolean;
  operator: boolean;
};

/**
 * useOptOutGate
 * Centralizes "are you sure?" gating when users opt out of critical add-ons.
 *
 * Responsibilities:
 * - Compute which add-ons are missing
 * - Stage the submit values if confirmation is required
 * - Expose dialog state and a confirm handler to proceed
 *
 * Keeps the form component lean and testable.
 */
export function useOptOutGate(opts: {
  insuranceOn: boolean;
  deliveryOn: boolean;
  pickupOn: boolean;
  operatorOn: boolean;
  /** Called when we can proceed (either immediately or after confirm) */
  onProceed: (values: BookingFormValues) => void | Promise<void>;
}) {
  const { insuranceOn, deliveryOn, pickupOn, operatorOn, onProceed } = opts;

  // Dialog UI state and staged values for deferred submit
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [missing, setMissing] = React.useState<MissingAddOns>({
    insurance: false,
    delivery: false,
    pickup: false,
    operator: false,
  });
  const stagedRef = React.useRef<BookingFormValues | null>(null);

  /** Call from form.handleSubmit(...) to intercept and possibly show dialog */
  const onSubmitAttempt = React.useCallback(
    (values: BookingFormValues) => {
      const miss: MissingAddOns = {
        insurance: !insuranceOn,
        delivery: !deliveryOn,
        pickup: !pickupOn,
        operator: !operatorOn,
      };

      if (miss.insurance || miss.delivery || miss.pickup || miss.operator) {
        setMissing(miss);
        stagedRef.current = values;
        setDialogOpen(true);
        return;
      }

      return onProceed(values);
    },
    [insuranceOn, deliveryOn, pickupOn, operatorOn, onProceed]
  );

  /** Call from the dialog's confirm button to proceed with the staged values */
  const onConfirm = React.useCallback(() => {
    setDialogOpen(false);
    const staged = stagedRef.current;
    if (staged) {
      void onProceed(staged);
      stagedRef.current = null;
    }
  }, [onProceed]);

  return {
    dialogOpen,
    setDialogOpen,
    missing,
    onSubmitAttempt,
    onConfirm,
  };
}
