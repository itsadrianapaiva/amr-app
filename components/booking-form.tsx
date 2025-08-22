"use client";

import { useState } from "react";
import { addDays, startOfDay } from "date-fns";

import type { SerializableMachine } from "@/lib/types";
import {
  buildBookingSchema,
  type BookingFormValues,
} from "@/lib/validation/booking";
import type { DisabledRangeJSON } from "@/lib/availability";
import { INSURANCE_CHARGE } from "@/lib/config";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PriceSummary } from "@/components/booking/price-summary";
import { AddOnsPanel } from "@/components/booking/add-ons-panel";
import { DateRangeInput } from "@/components/booking/date-range-input";
import { DateRange } from "react-day-picker";
import { useBookingFormLogic } from "@/lib/hooks/use-booking-form-logic";

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

  // Local state for add-ons
  const [deliverySelected, setDeliverySelected] = useState(true);
  const [pickupSelected, setPickupSelected] = useState(true);
  const [insuranceSelected, setInsuranceSelected] = useState(true);

  async function onSubmit(values: BookingFormValues) {
    console.info("Booking form submitted", {
      ...values,
      machineId: machine.id,
    });
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
            <FormField
              control={form.control}
              name="dateRange"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Rental Dates</FormLabel>
                  <FormControl>
                    <DateRangeInput
                      value={field.value as DateRange | undefined}
                      onChange={field.onChange}
                      disabledDays={disabledDays}
                      helperText="Earliest start is tomorrow. Same-day rentals are not available."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
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

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="name">Full Name</FormLabel>
                  <FormControl>
                    <Input
                      id="name"
                      placeholder="Your full name"
                      autoComplete="name"
                      required
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="email">Email</FormLabel>
                  <FormControl>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your.email@example.com"
                      autoComplete="email"
                      required
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="phone">Phone Number</FormLabel>
                  <FormControl>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="Contact phone number"
                      autoComplete="tel"
                      required
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isSubmitDisabled}>
              {form.formState.isSubmitting ? "Submitting..." : "Submit"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
