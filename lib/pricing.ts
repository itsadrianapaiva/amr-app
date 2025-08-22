/**
 * Pure helpers for consistent pricing math on client and server.
 * Keep all numbers in cents or in plain numbers consistently.
 * Here we use plain numbers (euros) since your UI already works with them.
 */

import { differenceInCalendarDays } from "date-fns";

export type PriceInputs = {
  rentalDays: number;
  dailyRate: number;
  deliverySelected: boolean;
  pickupSelected: boolean;
  insuranceSelected: boolean;
  deliveryCharge?: number | null;
  pickupCharge?: number | null;
  insuranceCharge?: number | null; // pass null to show TBD without affecting totals
};

export type PriceBreakdown = {
  rentalDays: number;
  subtotal: number;
  delivery: number;
  pickup: number;
  insurance: number;
  total: number;
};

/** Inclusive rental days: 10 to 12 -> 3 days */
export function computeRentalDays(from?: Date, to?: Date): number {
  if (!from || !to) return 0;
  return differenceInCalendarDays(to, from) + 1;
}

/** Deterministic totals used by UI and server */
export function computeTotals({
  rentalDays,
  dailyRate,
  deliverySelected,
  pickupSelected,
  insuranceSelected,
  deliveryCharge = 0,
  pickupCharge = 0,
  insuranceCharge = null,
}: PriceInputs): PriceBreakdown {
  const safeDelivery = deliverySelected ? Number(deliveryCharge ?? 0) : 0;
  const safePickup = pickupSelected ? Number(pickupCharge ?? 0) : 0;

  // Only count insurance in total when a concrete price is provided
  const safeInsurance =
    insuranceSelected && insuranceCharge != null
      ? Number(insuranceCharge ?? 0)
      : 0;

  const subtotal = rentalDays * dailyRate;
  const total = subtotal + safeDelivery + safePickup + safeInsurance;

  return {
    rentalDays,
    subtotal,
    delivery: safeDelivery,
    pickup: safePickup,
    insurance: safeInsurance,
    total,
  };
}
