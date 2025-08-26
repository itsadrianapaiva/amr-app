"use client";

import * as React from "react";
import type { UseFormReturn } from "react-hook-form";
import type { BookingFormValues } from "@/lib/validation/booking";

/**
 * The four boolean add-ons we gate.
 */
type AddonKey =
  | "deliverySelected"
  | "pickupSelected"
  | "insuranceSelected"
  | "operatorSelected";

/**
 * useAddonToggles
 * Centralizes:
 *  - live boolean state for the four add-ons (via RHF watch)
 *  - debounced-safe toggle handlers with validation triggers where needed
 *
 * Returns booleans + handlers + a derived flag for showing the address section.
 * Keeps BookingForm lean and testable.
 */
export function useAddonToggles(form: UseFormReturn<BookingFormValues>) {
  // Live values from RHF. This subscription updates when any of these fields change.
  const [
    deliverySelected,
    pickupSelected,
    insuranceSelected,
    operatorSelected,
  ] = form.watch([
    "deliverySelected",
    "pickupSelected",
    "insuranceSelected",
    "operatorSelected",
  ]) as boolean[];

  // Small helper to flip a boolean field and optionally revalidate the address block.
  const toggle = React.useCallback(
    (key: AddonKey, revalidateAddress: boolean) => {
      const current = form.getValues(key) as boolean;
      form.setValue(key, !current, {
        shouldDirty: true,
        shouldValidate: true,
      });
      if (revalidateAddress) {
        void form.trigger("siteAddress");
      }
    },
    [form]
  );

  const onToggleDelivery = React.useCallback(
    () => toggle("deliverySelected", true),
    [toggle]
  );
  const onTogglePickup = React.useCallback(
    () => toggle("pickupSelected", true),
    [toggle]
  );
  const onToggleInsurance = React.useCallback(
    () => toggle("insuranceSelected", false),
    [toggle]
  );
  const onToggleOperator = React.useCallback(
    () => toggle("operatorSelected", false),
    [toggle]
  );

  const showAddress = deliverySelected || pickupSelected;

  return {
    // state
    deliverySelected: !!deliverySelected,
    pickupSelected: !!pickupSelected,
    insuranceSelected: !!insuranceSelected,
    operatorSelected: !!operatorSelected,
    showAddress,

    // handlers
    onToggleDelivery,
    onTogglePickup,
    onToggleInsurance,
    onToggleOperator,
  };
}
