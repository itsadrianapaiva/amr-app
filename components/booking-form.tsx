"use client";

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
import PriceSummary from "@/components/booking/price-summary";
import { AddOnsPanel } from "@/components/booking/add-ons-panel";
import { useBookingFormLogic } from "@/lib/hooks/use-booking-form-logic";
import { DateRangeSection } from "@/components/booking/sections/date-range-section";
import { ContactSection } from "@/components/booking/sections/contact-section";
import { deriveDateRangeError } from "@/lib/forms/date-range-errors";

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

  // Pass initial add-on defaults so there is no mount-time reset
  const { form, rentalDays, disabledDays } = useBookingFormLogic({
    schema,
    disabledRangesJSON,
    defaultValues: {
      dateRange: { from: undefined, to: undefined },
      name: "",
      email: "",
      phone: "",
      deliverySelected: true,
      pickupSelected: true,
      insuranceSelected: true,
    },
  });

  // Read add-on values directly from RHF
  const [deliverySelected, pickupSelected, insuranceSelected] = form.watch([
    "deliverySelected",
    "pickupSelected",
    "insuranceSelected",
  ]) as boolean[];

  // Derive date error using shared helper
  const { message: dateErrorMessage, invalid: isDateInvalid } =
    deriveDateRangeError({
      errors: form.formState.errors as any, // keep helper decoupled from RHF types
      rentalDays,
      minDays,
    });

  async function onSubmit(values: BookingFormValues) {
    const payload = {
      ...values,
      deliverySelected,
      pickupSelected,
      insuranceSelected,
      rentalDays,
      machineId: machine.id,
    };
    // Server Action will replace this
    console.info("Booking form submitted", payload);
  }

  const isSubmitDisabled =
    !form.formState.isValid || rentalDays === 0 || form.formState.isSubmitting;

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
                void form.trigger("dateRange");
              }}
            />

            {/* Add-ons controlled by RHF */}
            <AddOnsPanel
              deliverySelected={!!deliverySelected}
              pickupSelected={!!pickupSelected}
              insuranceSelected={!!insuranceSelected}
              onToggleDelivery={() =>
                form.setValue("deliverySelected", !deliverySelected, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              onTogglePickup={() =>
                form.setValue("pickupSelected", !pickupSelected, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              onToggleInsurance={() =>
                form.setValue("insuranceSelected", !insuranceSelected, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              minDays={machine.minDays}
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
                insuranceCharge={insuranceSelected ? INSURANCE_CHARGE : null}
              />
            )}

            {/* Contact fields */}
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
