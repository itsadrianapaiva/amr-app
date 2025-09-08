"use client";

import * as React from "react";
import { PriceSummary } from "@/components/booking/price-summary";

type Props = {
  // Derived values
  rentalDays: number;
  dailyRate: number;
  deposit: number;

  // Add-on state and pricing
  deliverySelected: boolean;
  pickupSelected: boolean;
  insuranceSelected: boolean;
  operatorSelected: boolean;

  deliveryCharge: number;
  pickupCharge: number;
  insuranceCharge: number;
  operatorCharge: number | null;
};

/**
 * SummaryPanel
 * Stateless presenter that shows:
 * - The existing PriceSummary breakdown
 * - A compact compliance note: VAT is calculated at Checkout
 * - A business note: refundable deposit due at handover
 */
export default function SummaryPanel({
  rentalDays,
  dailyRate,
  deposit,
  deliverySelected,
  pickupSelected,
  insuranceSelected,
  operatorSelected,
  deliveryCharge,
  pickupCharge,
  insuranceCharge,
  operatorCharge,
}: Props) {
  if (rentalDays <= 0) return null;

  return (
    <div className="space-y-2">
      <PriceSummary
        rentalDays={rentalDays}
        dailyRate={dailyRate}
        deposit={deposit}
        deliverySelected={deliverySelected}
        pickupSelected={pickupSelected}
        insuranceSelected={insuranceSelected}
        deliveryCharge={deliveryCharge}
        pickupCharge={pickupCharge}
        insuranceCharge={insuranceCharge}
        operatorSelected={operatorSelected}
        operatorCharge={operatorCharge}
      />
    </div>
  );
}
