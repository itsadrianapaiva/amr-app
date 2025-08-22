"use client";

import { useState, useEffect } from "react";
import { addDays, startOfDay } from "date-fns";

import type { SerializableMachine } from "@/lib/types";
import {
  buildBookingSchema,
  type BookingFormValues,
} from "@/lib/validation/booking";
import type { DisabledRangeJSON } from "@/lib/availability";
import { INSURANCE_CHARGE } from "@/lib/config";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PriceSummary } from "@/components/booking/price-summary";
import { AddOnsPanel } from "@/components/booking/add-ons-panel";
import { useBookingFormLogic } from "@/lib/hooks/use-booking-form-logic";
import { DateRangeSection } from "@/components/booking/sections/date-range-section";
import { ContactSection } from "@/components/booking/sections/contact-section";

type BookingFormProps = {
  machine: Pick<
    SerializableMachine,
    | "id"
    | "dailyRate"
    | "deposit"
    | "deliveryCharge"
    | "pickupCharge"
    | "minDays"
  >;
  disabledRangesJSON?: DisabledRangeJSON[];
};

export function BookingForm({ machine, disabledRangesJSON }: BookingFormProps) {
  const dailyRate = Number(machine.dailyRate);
  const deliveryCharge = Number(machine.deliveryCharge ?? 0);
  const pickupCharge = Number(machine.pickupCharge ?? 0);
  const deposit = Number(machine.deposit);
  const minDays = machine.minDays;

  const minStart = startOfDay(addDays(new Date(), 1));
  const schema = buildBookingSchema(minStart, minDays);

  const { form, rentalDays, disabledDays } = useBookingFormLogic({
    schema, // concrete Zod schema for THIS machine
    disabledRangesJSON, // server ranges to merge with policy
  });

  // Local state for add-ons . opt-out default to reinforce user choice
  const [deliverySelected, setDeliverySelected] = useState(true);
  const [pickupSelected, setPickupSelected] = useState(true);
  const [insuranceSelected, setInsuranceSelected] = useState(true);

  //Sync form state with local add-on selections
  useEffect(() => {
    form.setValue("deliverySelected", deliverySelected, {
      shouldValidate: true,
      shouldDirty: true,
    });
  }, [deliverySelected, form]);

  useEffect(() => {
    form.setValue("pickupSelected", pickupSelected, {
      shouldValidate: true,
      shouldDirty: true,
    });
  }, [pickupSelected, form]);

  useEffect(() => {
    form.setValue("insuranceSelected", insuranceSelected, {
      shouldValidate: true,
      shouldDirty: true,
    });
  }, [insuranceSelected, form]);

  // Simple date error derivation: favor min-days clarity
  const dateFromError = form.formState.errors?.dateRange?.from?.message as
    | string
    | undefined;
  const dateToError = form.formState.errors?.dateRange?.to?.message as
    | string
    | undefined;

  let dateErrorMessage: string | undefined = undefined;
  if (dateFromError) {
    dateErrorMessage = dateFromError;
  } else if (dateToError) {
    dateErrorMessage = dateToError;
  } else if (rentalDays > 0 && rentalDays < minDays) {
    dateErrorMessage = `Minimum rental is ${minDays} ${
      minDays > 1 ? "days" : "day"
    }. You selected ${rentalDays}.`;
  }
  const isDateInvalid = Boolean(dateErrorMessage);

  async function onSubmit(values: BookingFormValues) {
    const payload = {
      ...values,
      deliverySelected,
      pickupSelected,
      insuranceSelected,
      rentalDays, // derived by the hook
      machineId: machine.id,
    };

    // Replace this with Server Action when ready
    console.info("Booking form submitted", payload);
  }

  const isSubmitDisabled =
    !form.formState.isValid ||
    rentalDays === 0 || // require a valid range (derived by the hook)
    form.formState.isSubmitting;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Book this Machine</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Date Range with minimal alerting and live validation */}
            <DateRangeSection
              control={form.control}
              disabledDays={disabledDays}
              helperText="Earliest start is tomorrow. Same-day rentals are not available."
              isInvalid={isDateInvalid}
              errorMessage={dateErrorMessage}
              onRangeChange={() => {
                // Trigger validation immediately so wrong ranges show the alert
                void form.trigger("dateRange");
              }}
            />

            {/* ADD-ONS */}
            <AddOnsPanel
              deliverySelected={deliverySelected}
              pickupSelected={pickupSelected}
              insuranceSelected={insuranceSelected}
              onToggleDelivery={setDeliverySelected}
              onTogglePickup={setPickupSelected}
              onToggleInsurance={setInsuranceSelected}
              minDays={machine.minDays}
            />

            {/* PRICE SUMMARY CALL */}
            {rentalDays > 0 && (
              <PriceSummary
                rentalDays={rentalDays}
                dailyRate={dailyRate}
                deposit={deposit}
                deliverySelected={deliverySelected}
                pickupSelected={pickupSelected}
                insuranceSelected={insuranceSelected}
                deliveryCharge={deliveryCharge}
                pickupCharge={pickupCharge}
                insuranceCharge={insuranceSelected ? INSURANCE_CHARGE : null}
              />
            )}

            {/* CONTACT SECTION */}
            <ContactSection control={form.control} />

            <Button type="submit" disabled={isSubmitDisabled}>
              {form.formState.isSubmitting ? "Submitting..." : "Submit"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
