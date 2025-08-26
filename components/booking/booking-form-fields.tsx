"use client";

import * as React from "react";
import type { Control } from "react-hook-form";

import { AddOnsPanel } from "@/components/booking/add-ons-panel";
import { PriceSummary } from "@/components/booking/price-summary";
import { DateRangeSection } from "@/components/booking/sections/date-range-section";
import { ContactSection } from "@/components/booking/sections/contact-section";
import DeliveryAddressSection from "@/components/booking/sections/delivery-address-section";
import { BillingSection } from "@/components/booking/sections/billing-section";

import { Button } from "@/components/ui/button";
import { INSURANCE_CHARGE, OPERATOR_CHARGE } from "@/lib/config";
import type { BookingFormValues } from "@/lib/validation/booking";

/**
 * BookingFormFields
 * Pure presentational component: renders all field sections and the submit block.
 * It is *stateless* and does not depend on RHF instance methods besides `control`.
 */
export default function BookingFormFields(props: {
  // Form wiring
  control: Control<BookingFormValues>;

  // Date policy + validation visuals
  disabledDays: any[];
  helperText: string;
  isDateInvalid: boolean;
  dateErrorMessage?: string | undefined;
  onRangeChange: () => void;

  // Pricing context and derived values
  rentalDays: number;
  dailyRate: number;
  deposit: number;
  deliveryCharge: number;
  pickupCharge: number;
  minDays: number;

  // Add-on state + handlers (stateless toggles)
  deliverySelected: boolean;
  pickupSelected: boolean;
  insuranceSelected: boolean;
  operatorSelected: boolean;
  onToggleDelivery: () => void;
  onTogglePickup: () => void;
  onToggleInsurance: () => void;
  onToggleOperator: () => void;

  // Conditional surfaces
  showAddress: boolean;

  // Submit visuals
  isSubmitDisabled: boolean;
  rootError?: string | null;
}) {
  const {
    control,
    disabledDays,
    helperText,
    isDateInvalid,
    dateErrorMessage,
    onRangeChange,

    rentalDays,
    dailyRate,
    deposit,
    deliveryCharge,
    pickupCharge,
    minDays,

    deliverySelected,
    pickupSelected,
    insuranceSelected,
    operatorSelected,
    onToggleDelivery,
    onTogglePickup,
    onToggleInsurance,
    onToggleOperator,

    showAddress,

    isSubmitDisabled,
    rootError,
  } = props;

  return (
    <div className="space-y-8">
      {/* Date Range with minimal alerting and live validation */}
      <DateRangeSection
        control={control}
        disabledDays={disabledDays}
        helperText={helperText}
        isInvalid={isDateInvalid}
        errorMessage={dateErrorMessage}
        onRangeChange={onRangeChange}
      />

      {/* Add-ons controlled by RHF via lifted handlers */}
      <AddOnsPanel
        deliverySelected={!!deliverySelected}
        pickupSelected={!!pickupSelected}
        operatorSelected={!!operatorSelected}
        insuranceSelected={!!insuranceSelected}
        onToggleDelivery={onToggleDelivery}
        onTogglePickup={onTogglePickup}
        onToggleOperator={onToggleOperator}
        onToggleInsurance={onToggleInsurance}
        minDays={minDays}
      />

      {/* Price summary */}
      {rentalDays > 0 && (
        <PriceSummary
          rentalDays={rentalDays}
          dailyRate={dailyRate}
          deposit={deposit}
          deliverySelected={!!deliverySelected}
          pickupSelected={!!pickupSelected}
          insuranceSelected={!!insuranceSelected}
          deliveryCharge={deliveryCharge}
          pickupCharge={pickupCharge}
          insuranceCharge={INSURANCE_CHARGE}
          operatorSelected={!!operatorSelected}
          operatorCharge={operatorSelected ? OPERATOR_CHARGE : null}
        />
      )}

      {/* Contact fields */}
      <ContactSection control={control} />

      {/* Delivery/Pickup address when either is selected */}
      {showAddress && <DeliveryAddressSection control={control} />}

      {/* Company invoicing when applicable */}
      <BillingSection />

      {/* Submit block */}
      <div className="space-y-2">
        <Button type="submit" disabled={isSubmitDisabled}>
          Book Now
        </Button>
        {rootError && <p className="text-sm text-red-600">{rootError}</p>}
      </div>
    </div>
  );
}
