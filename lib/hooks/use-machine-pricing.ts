"use client";

import { useMemo } from "react";
import type { SerializableMachine } from "@/lib/types";

/**
 * The minimal shape we need from a machine for pricing math.
 */
export type PricingMachine = Pick<
  SerializableMachine,
  "dailyRate" | "deposit" | "deliveryCharge" | "pickupCharge" | "minDays"
>;

/**
 * Tiny helper to coerce unknown/nullable values into safe numbers.
 * Returns 0 when the value is NaN/Infinity/undefined.
 */
function safeNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * useMachinePricing
 * Memoized numeric pricing fields for a given machine.
 * Keeps BookingForm lean and removes repetitive Number(...) calls.
 */
export function useMachinePricing(machine: PricingMachine) {
  // Coerce everything once and memoize so renders stay cheap and predictable.
  const dailyRate = useMemo(
    () => safeNumber(machine.dailyRate),
    [machine.dailyRate]
  );
  const deposit = useMemo(() => safeNumber(machine.deposit), [machine.deposit]);
  const deliveryCharge = useMemo(
    () => safeNumber(machine.deliveryCharge ?? 0),
    [machine.deliveryCharge]
  );
  const pickupCharge = useMemo(
    () => safeNumber(machine.pickupCharge ?? 0),
    [machine.pickupCharge]
  );

  // minDays is already a number in our SerializableMachine. Guard anyway.
  const minDays = useMemo(() => safeNumber(machine.minDays), [machine.minDays]);

  return {
    dailyRate,
    deposit,
    deliveryCharge,
    pickupCharge,
    minDays,
  };
}
