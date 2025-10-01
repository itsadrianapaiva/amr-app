"use client";

import * as React from "react";
import type { Control } from "react-hook-form";
import type { Matcher } from "react-day-picker";

import { AddOnsPanel } from "@/components/booking/add-ons-panel";
import { DateRangeSection } from "@/components/booking/sections/date-range-section";
import { ContactSection } from "@/components/booking/sections/contact-section";
import DeliveryAddressSection from "@/components/booking/sections/delivery-address-section";
import { BillingSection } from "@/components/booking/sections/billing-section";

import { Button } from "@/components/ui/button";
import type { BookingFormValues } from "@/lib/validation/booking";
import Ga4Click from "../analytics/ga4-clicking";

/**
 * BookingFormFields
 * Pure presentational component: renders all field sections and the submit block.
 * It is *stateless* and does not depend on RHF instance methods besides `control`.
 */
export default function BookingFormFields(props: {
  // Form wiring
  control: Control<BookingFormValues>;

  // Date policy + validation visuals
  disabledDays?: Matcher | Matcher[];
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

  // Slot to inject a summary block (e.g., <SummaryPanel />) between Add-ons and Contact
  summary?: React.ReactNode;

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

    // Keep pricing props available for future sub-sections if needed
    // rentalDays, dailyRate, deposit, deliveryCharge, pickupCharge,

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

    summary,

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

      {/* Summary slot (renders pricing breakdown + notes) */}
      {summary ?? null}

      {/* Contact fields */}
      <ContactSection control={control} />

      {/* Delivery/Pickup address when either is selected */}
      {showAddress && <DeliveryAddressSection control={control} />}

      {/* Company invoicing when applicable */}
      <BillingSection />

      {/* Submit block */}
      <div className="space-y-2">
        {/* Wrap the submit button to emit a GA4 micro-conversion on click */}
        <Ga4Click
          event="booking_submit"
          params={{
            page: "booking",
            intent: "checkout",
            submitDisabled: isSubmitDisabled, // helps see if click happened while button was disabled
          }}
          once
        >
          <Button type="submit" disabled={isSubmitDisabled}>
            Book Now
          </Button>
        </Ga4Click>

        {rootError && <p className="text-sm text-red-600">{rootError}</p>}
      </div>
    </div>
  );
}
