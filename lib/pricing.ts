/**
 * Pure helpers for consistent pricing math on client and server.
 * All monetary values are in euros (not cents).
 * VAT is applied separately by Stripe during checkout.
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

  operatorSelected?: boolean; // optional for backward compatibility
  operatorCharge?: number | null; // null => don't count it in totals

  discountPercentage?: number; // NIF-based discount (0-100)
};

export type PriceBreakdown = {
  rentalDays: number;
  subtotal: number;
  delivery: number;
  pickup: number;
  insurance: number;
  operator: number;
  discount: number;
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

  operatorSelected = false,
  operatorCharge = null,

  discountPercentage = 0,
}: PriceInputs): PriceBreakdown {
  const safeDelivery = deliverySelected ? Number(deliveryCharge ?? 0) : 0;
  const safePickup = pickupSelected ? Number(pickupCharge ?? 0) : 0;

  // Only count insurance in total when a concrete price is provided
  const safeInsurance =
    insuranceSelected && insuranceCharge != null
      ? Number(insuranceCharge ?? 0)
      : 0;

  // Operator is charged per day if selected and we have a concrete price
  const safeOperator =
    operatorSelected && operatorCharge != null
      ? Number(operatorCharge ?? 0) * rentalDays
      : 0;

  const subtotal = rentalDays * dailyRate;
  const subtotalBeforeDiscount =
    subtotal + safeDelivery + safePickup + safeInsurance + safeOperator;

  // Apply discount percentage to the subtotal (before VAT)
  const discountAmount =
    discountPercentage > 0 && discountPercentage <= 100
      ? (subtotalBeforeDiscount * discountPercentage) / 100
      : 0;

  const total = subtotalBeforeDiscount - discountAmount;

  return {
    rentalDays,
    subtotal,
    delivery: safeDelivery,
    pickup: safePickup,
    insurance: safeInsurance,
    operator: safeOperator,
    discount: discountAmount,
    total,
  };
}

// ============================================================================
// Cart-ready: Item-aware pricing engine
// ============================================================================

/**
 * Pricing item input for item-aware pricing.
 * Represents a single machine or addon in the booking.
 */
export type PricingItemInput = {
  /** Number of units for this item (1 for PRIMARY, N for PER_UNIT addons) */
  quantity: number;
  /** Charge model: PER_BOOKING (flat) or PER_UNIT (multiplied by quantity) */
  chargeModel: "PER_BOOKING" | "PER_UNIT";
  /** Time unit: DAY or HOUR */
  timeUnit: "DAY" | "HOUR";
  /** Unit price in euros (snapshot from Machine.dailyRate at booking time) */
  unitPrice: number;
};

/**
 * Pricing context for item-aware pricing.
 * Contains shared factors that apply to all items (delivery, insurance, etc).
 */
export type PricingContextInput = {
  /** Number of rental days (computed from startDate/endDate) */
  rentalDays: number;

  /** Add-on selections */
  deliverySelected: boolean;
  pickupSelected: boolean;
  insuranceSelected: boolean;
  operatorSelected?: boolean;

  /** Add-on charges (euros) */
  deliveryCharge?: number | null;
  pickupCharge?: number | null;
  insuranceCharge?: number | null;
  operatorCharge?: number | null;

  /** Discount percentage (0-100) applied to entire subtotal */
  discountPercentage?: number;
};

/**
 * Compute totals from a list of items (Cart-ready pricing engine).
 * Preserves exact parity with computeTotals for single-item, day-based bookings.
 *
 * @param context - Shared pricing factors (days, add-ons, discount)
 * @param items - Array of items to price (machines + addons)
 * @returns PriceBreakdown with identical semantics to computeTotals
 */
export function computeTotalsFromItems(
  context: PricingContextInput,
  items: PricingItemInput[]
): PriceBreakdown {
  const {
    rentalDays,
    deliverySelected,
    pickupSelected,
    insuranceSelected,
    operatorSelected = false,
    deliveryCharge = 0,
    pickupCharge = 0,
    insuranceCharge = null,
    operatorCharge = null,
    discountPercentage = 0,
  } = context;

  // Compute item subtotal
  let itemSubtotal = 0;

  for (const item of items) {
    const { quantity, chargeModel, timeUnit, unitPrice } = item;

    // Base price calculation
    let base: number;
    if (chargeModel === "PER_BOOKING") {
      base = unitPrice;
    } else if (chargeModel === "PER_UNIT") {
      base = unitPrice * quantity;
    } else {
      throw new Error(`Unknown chargeModel: ${chargeModel}`);
    }

    // Time-based multiplication
    if (timeUnit === "DAY") {
      itemSubtotal += base * rentalDays;
    } else if (timeUnit === "HOUR") {
      // TODO: Implement hourly pricing when needed (requires startAt/endAt timestamps)
      throw new Error("HOUR-based pricing not yet implemented");
    } else {
      throw new Error(`Unknown timeUnit: ${timeUnit}`);
    }
  }

  // Apply add-ons (identical logic to computeTotals)
  const safeDelivery = deliverySelected ? Number(deliveryCharge ?? 0) : 0;
  const safePickup = pickupSelected ? Number(pickupCharge ?? 0) : 0;

  const safeInsurance =
    insuranceSelected && insuranceCharge != null
      ? Number(insuranceCharge ?? 0)
      : 0;

  const safeOperator =
    operatorSelected && operatorCharge != null
      ? Number(operatorCharge ?? 0) * rentalDays
      : 0;

  const subtotalBeforeDiscount =
    itemSubtotal + safeDelivery + safePickup + safeInsurance + safeOperator;

  // Apply discount (identical logic to computeTotals)
  const discountAmount =
    discountPercentage > 0 && discountPercentage <= 100
      ? (subtotalBeforeDiscount * discountPercentage) / 100
      : 0;

  const total = subtotalBeforeDiscount - discountAmount;

  return {
    rentalDays,
    subtotal: itemSubtotal,
    delivery: safeDelivery,
    pickup: safePickup,
    insurance: safeInsurance,
    operator: safeOperator,
    discount: discountAmount,
    total,
  };
}
