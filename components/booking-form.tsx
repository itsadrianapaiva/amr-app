"use client";

import * as React from "react";
import { addDays, startOfDay } from "date-fns";

import type { SerializableMachine } from "@/lib/types";
import {
  buildBookingSchema,
  type BookingFormValues,
} from "@/lib/validation/booking";
import type { DisabledRangeJSON } from "@/lib/availability";
import { INSURANCE_CHARGE, OPERATOR_CHARGE } from "@/lib/config";

import { createDepositCheckoutAction } from "@/app/actions/create-deposit-checkout";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PriceSummary } from "@/components/booking/price-summary";
import { AddOnsPanel } from "@/components/booking/add-ons-panel";
import { DateRangeSection } from "@/components/booking/sections/date-range-section";
import { ContactSection } from "@/components/booking/sections/contact-section";
import { BillingSection } from "@/components/booking/sections/billing-section";
import DeliveryAddressSection from "./booking/sections/delivery-address-section";
import { deriveDateRangeError } from "@/lib/forms/date-range-errors";
import { useBookingFormLogic } from "@/lib/hooks/use-booking-form-logic";
import AddOnOptOutDialog from "@/components/booking/add-on-optout-dialog";
import { useBookingDraft } from "@/lib/hooks/use-booking-draft";
import { useOptOutGate } from "@/lib/hooks/use-optout-gate";
import { useMachinePricing } from "@/lib/hooks/use-machine-pricing";

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
  const {
    dailyRate,
    deposit,
    deliveryCharge,
    pickupCharge,
    minDays,
  } = useMachinePricing({
    dailyRate: machine.dailyRate,
    deposit: machine.deposit,
    deliveryCharge: machine.deliveryCharge,
    pickupCharge: machine.pickupCharge,
    minDays: machine.minDays,
  });

  // Schema built with minStart policy (tomorrow 00:00)
  const minStart = startOfDay(addDays(new Date(), 1));
  const schema = buildBookingSchema(minStart, minDays);

  // RHF + defaults: keep add-ons explicit to avoid mount-time flips.
  // We’ll formalize operator + billing fields in the Zod schema shortly.
  const { form, rentalDays, disabledDays } = useBookingFormLogic({
    schema,
    disabledRangesJSON,
    defaultValues: {
      // Date range
      dateRange: { from: undefined, to: undefined },
      // Contact
      name: "",
      email: "",
      phone: "",
      customerNIF: "",
      // Operational site address defaults - keep inputs controlled
      siteAddress: {
        line1: "",
        postalCode: "",
        city: "",
        notes: "",
      },
      // add-ons
      deliverySelected: true,
      pickupSelected: true,
      insuranceSelected: true,
      operatorSelected: false,
      // billings
      billingIsBusiness: false,
      billingCompanyName: "",
      billingTaxId: "",
      billingAddressLine1: "",
      billingPostalCode: "",
      billingCity: "",
      billingCountry: "",
    } as Partial<BookingFormValues>,
  });

  // Session draft (load on mount, save on change)
  // The hook encapsulates serialization, versioning and debounce.
  useBookingDraft({ form, machineId: machine.id });

  // Live add-on values directly from RHF
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

  // Derive date error using shared helper
  const { message: dateErrorMessage, invalid: isDateInvalid } =
    deriveDateRangeError({
      errors: form.formState.errors as any, // keep helper decoupled from RHF types
      rentalDays,
      minDays,
    });

  // submit calls our server action and redirects to Stripe
  async function baseOnSubmit(values: BookingFormValues) {
    try {
      const payload = { ...values, machineId: machine.id };
      const { url } = await createDepositCheckoutAction(payload);
      window.location.assign(url); // Keep draft; we clear on success page
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong creating the checkout.";
      form.setError("root", { type: "server", message });
    }
  }

  // Opt-out gating extracted to a tiny hook (removes local dialog state/refs)
  const { dialogOpen, setDialogOpen, missing, onSubmitAttempt, onConfirm } =
    useOptOutGate({
      insuranceOn: !!insuranceSelected,
      deliveryOn: !!deliverySelected,
      pickupOn: !!pickupSelected,
      operatorOn: !!operatorSelected,
      onProceed: baseOnSubmit,
    });

  // Only block when dates are invalid/empty or we’re submitting.
  // RHF + resolver will still prevent submission and surface errors if any required field is invalid.
  const isSubmitDisabled =
    form.formState.isSubmitting || rentalDays === 0 || isDateInvalid;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Book this Machine</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Dialog mounted once; uses portal overlay */}
        <AddOnOptOutDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          missing={missing}
          onConfirm={onConfirm}
        />

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmitAttempt)}
            className="space-y-8"
          >
            {/* Date range with minimal alerting and live validation */}
            <DateRangeSection
              control={form.control}
              disabledDays={disabledDays}
              helperText="Earliest start is tomorrow. Same-day rentals are not available."
              isInvalid={isDateInvalid}
              errorMessage={dateErrorMessage}
              onRangeChange={() => void form.trigger("dateRange")}
            />

            {/* Add-ons controlled by RHF */}
            <AddOnsPanel
              deliverySelected={!!deliverySelected}
              pickupSelected={!!pickupSelected}
              operatorSelected={!!operatorSelected}
              insuranceSelected={!!insuranceSelected}
              onToggleDelivery={() => {
                form.setValue("deliverySelected", !deliverySelected, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
                void form.trigger("siteAddress");
              }}
              onTogglePickup={() => {
                form.setValue("pickupSelected", !pickupSelected, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
                void form.trigger("siteAddress");
              }}
              onToggleOperator={() =>
                form.setValue("operatorSelected", !operatorSelected, {
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

            {/* Price summary renders only when we have at least 1 rental day */}
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
            <ContactSection control={form.control} />

            {/* Delivery/Pickup address when either is selected */}
            {(deliverySelected || pickupSelected) && (
              <DeliveryAddressSection control={form.control} />
            )}

            {/* Company invoicing when applicable */}
            <BillingSection />

            <div className="space-y-2">
              <Button type="submit" disabled={isSubmitDisabled}>
                {form.formState.isSubmitting ? "Booking..." : "Book Now"}
              </Button>
              {form.formState.errors.root?.message && (
                <p className="text-sm text-red-600">
                  {form.formState.errors.root.message}
                </p>
              )}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
