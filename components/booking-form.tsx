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

import { Form } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AddOnOptOutDialog from "@/components/booking/add-on-optout-dialog";
import BookingFormFields from "@/components/booking/booking-form-fields";

import { deriveDateRangeError } from "@/lib/forms/date-range-errors";
import { useBookingFormLogic } from "@/lib/hooks/use-booking-form-logic";
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
  // 1) Pricing numbers coerced and memoized
  const { dailyRate, deposit, deliveryCharge, pickupCharge, minDays } =
    useMachinePricing({
      dailyRate: machine.dailyRate,
      deposit: machine.deposit,
      deliveryCharge: machine.deliveryCharge,
      pickupCharge: machine.pickupCharge,
      minDays: machine.minDays,
    });

  // 2) Date policy and schema (min start is tomorrow 00:00)
  const minStart = startOfDay(addDays(new Date(), 1));
  const schema = buildBookingSchema(minStart, minDays);

  // 3) RHF setup via centralized logic
  const { form, rentalDays, disabledDays } = useBookingFormLogic({
    schema,
    disabledRangesJSON,
    defaultValues: {
      dateRange: { from: undefined, to: undefined },
      name: "",
      email: "",
      phone: "",
      customerNIF: "",
      siteAddress: { line1: "", postalCode: "", city: "", notes: "" },
      deliverySelected: true,
      pickupSelected: true,
      insuranceSelected: true,
      operatorSelected: false,
      billingIsBusiness: false,
      billingCompanyName: "",
      billingTaxId: "",
      billingAddressLine1: "",
      billingPostalCode: "",
      billingCity: "",
      billingCountry: "",
    } as Partial<BookingFormValues>,
  });

  // 4) Session draft (load on mount, debounce save on change)
  useBookingDraft({ form, machineId: machine.id });

  // 5) Live add-on values from RHF
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

  // 6) Date error for presenter visuals
  const { message: dateErrorMessage, invalid: isDateInvalid } =
    deriveDateRangeError({
      errors: form.formState.errors as any,
      rentalDays,
      minDays,
    });

  // 7) Submit handler (server action) — creates PENDING booking and opens Stripe
  async function baseOnSubmit(values: BookingFormValues) {
    try {
      const payload = { ...values, machineId: machine.id };
      const { url } = await createDepositCheckoutAction(payload);
      window.location.assign(url); // keep draft; success page clears it
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong creating the checkout.";
      form.setError("root", { type: "server", message });
    }
  }

  // 8) Opt-out gating (keeps UX logic out of presenter)
  const { dialogOpen, setDialogOpen, missing, onSubmitAttempt, onConfirm } =
    useOptOutGate({
      insuranceOn: !!insuranceSelected,
      deliveryOn: !!deliverySelected,
      pickupOn: !!pickupSelected,
      operatorOn: !!operatorSelected,
      onProceed: baseOnSubmit,
    });

  // 9) Derived flags for presenter
  const isSubmitDisabled =
    form.formState.isSubmitting || rentalDays === 0 || isDateInvalid;
  const showAddress = deliverySelected || pickupSelected;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Book this Machine</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Dialog lives here; presenter stays stateless */}
        <AddOnOptOutDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          missing={missing}
          onConfirm={onConfirm}
        />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmitAttempt)}>
            <BookingFormFields
              control={form.control}
              disabledDays={disabledDays}
              helperText="Earliest start is tomorrow. Same-day rentals are not available."
              isDateInvalid={isDateInvalid}
              dateErrorMessage={dateErrorMessage ?? undefined}
              onRangeChange={() => void form.trigger("dateRange")}
              rentalDays={rentalDays}
              dailyRate={dailyRate}
              deposit={deposit}
              deliveryCharge={deliveryCharge}
              pickupCharge={pickupCharge}
              minDays={minDays}
              deliverySelected={!!deliverySelected}
              pickupSelected={!!pickupSelected}
              insuranceSelected={!!insuranceSelected}
              operatorSelected={!!operatorSelected}
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
              onToggleInsurance={() =>
                form.setValue("insuranceSelected", !insuranceSelected, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              onToggleOperator={() =>
                form.setValue("operatorSelected", !operatorSelected, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              showAddress={showAddress}
              isSubmitDisabled={isSubmitDisabled}
              rootError={form.formState.errors.root?.message ?? null}
            />
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
