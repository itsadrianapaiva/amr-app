"use client";

import * as React from "react";
import type { FieldErrors } from "react-hook-form";

import type { SerializableMachine } from "@/lib/types";
import type { BookingFormValues } from "@/lib/validation/booking";
import type { DisabledRangeJSON } from "@/lib/availability";

import { earliestStartText } from "@/lib/booking/earliest-start-text";
import { deriveDateRangeError } from "@/lib/forms/date-range-errors";
import { useBookingFormLogic } from "@/lib/hooks/use-booking-form-logic";
import { useBookingDraft } from "@/lib/hooks/use-booking-draft";
import { useMachinePricing } from "@/lib/hooks/use-machine-pricing";
import { useDatePolicy } from "@/lib/hooks/use-date-policy";
import { useAddonToggles } from "@/lib/hooks/use-addon-toggles";
import { useBookingSubmit } from "@/lib/hooks/use-booking-submit";
import { useOutOfAreaInfo } from "@/lib/forms/use-out-of-area";
import { useSubmitFlags } from "@/lib/forms/use-submit-flags";

import SummaryPanel from "@/components/booking/summary-panel";
import { INSURANCE_CHARGE, OPERATOR_CHARGE } from "@/lib/config";
import { Form } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AddOnOptOutDialog from "@/components/booking/add-on-optout-dialog";
import BookingFormFields from "@/components/booking/booking-form-fields";
import OutOfAreaBanner from "@/components/booking/out-of-area-banner";

const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@example.com";
const WHATSAPP_NUMBER =
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "351912345678";

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
  // 1) Money + constraints (pure numbers for UI)
  const { dailyRate, deposit, deliveryCharge, pickupCharge, minDays } =
    useMachinePricing({
      dailyRate: machine.dailyRate,
      deposit: machine.deposit,
      deliveryCharge: machine.deliveryCharge,
      pickupCharge: machine.pickupCharge,
      minDays: machine.minDays,
    });

  // 2) Date policy — Lisbon-aware minStart (heavy machines 5/6/7 get 2 days + 15:00 cutoff)
  const { minStart, schema } = useDatePolicy({
    minDays,
    machineId: machine.id,
  });

  // 3) RHF setup via centralized logic (pass minStart so calendar blocks early dates)
  const { form, rentalDays, disabledDays } = useBookingFormLogic({
    schema,
    disabledRangesJSON,
    minStart, // key: enforce the heavy-machine earliest start in the UI
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

  // 5) DRY add-on state + handlers
  const {
    deliverySelected,
    pickupSelected,
    insuranceSelected,
    operatorSelected,
    showAddress,
    onToggleDelivery,
    onTogglePickup,
    onToggleInsurance,
    onToggleOperator,
  } = useAddonToggles(form);

  // 6) Date error for presenter visuals
  const { message: dateErrorMessage, invalid: isDateInvalid } =
    deriveDateRangeError({
      errors: form.formState.errors as FieldErrors<BookingFormValues>,
      rentalDays,
      minDays,
    });

  // 7) Calendar helper text (pure helper)
  const helperText = earliestStartText({ machineId: machine.id, minStart });

  // 8) Submit orchestration (server action + opt-out gate)
  const { dialogOpen, setDialogOpen, missing, onSubmitAttempt, onConfirm } =
    useBookingSubmit({
      form,
      machineId: machine.id,
      insuranceOn: !!insuranceSelected,
      deliveryOn: !!deliverySelected,
      pickupOn: !!pickupSelected,
      operatorOn: !!operatorSelected,
    });

  // 9) Submit flags + root error (single source of truth)
  const { isSubmitDisabled, rootError } = useSubmitFlags({
    form,
    rentalDays,
    isDateInvalid,
  });

  // 10) Geofence UX (derived, reactive)
  const out = useOutOfAreaInfo(form, machine.id);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Book this Machine</CardTitle>
      </CardHeader>
      <CardContent>
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
              helperText={helperText}
              isDateInvalid={isDateInvalid}
              dateErrorMessage={dateErrorMessage ?? undefined}
              onRangeChange={() => void form.trigger("dateRange")}
              rentalDays={rentalDays}
              dailyRate={dailyRate}
              deposit={deposit}
              deliveryCharge={deliveryCharge}
              pickupCharge={pickupCharge}
              minDays={minDays}
              deliverySelected={deliverySelected}
              pickupSelected={pickupSelected}
              insuranceSelected={insuranceSelected}
              operatorSelected={operatorSelected}
              onToggleDelivery={onToggleDelivery}
              onTogglePickup={onTogglePickup}
              onToggleInsurance={onToggleInsurance}
              onToggleOperator={onToggleOperator}
              showAddress={showAddress}
              isSubmitDisabled={isSubmitDisabled}
              rootError={rootError}
              summary={
                <SummaryPanel
                  rentalDays={rentalDays}
                  dailyRate={dailyRate}
                  deposit={deposit}
                  deliverySelected={!!deliverySelected}
                  pickupSelected={!!pickupSelected}
                  insuranceSelected={!!insuranceSelected}
                  operatorSelected={!!operatorSelected}
                  deliveryCharge={deliveryCharge}
                  pickupCharge={pickupCharge}
                  insuranceCharge={INSURANCE_CHARGE}
                  operatorCharge={operatorSelected ? OPERATOR_CHARGE : null}
                />
              }
            />

            <OutOfAreaBanner
              visible={out.visible}
              supportEmail={SUPPORT_EMAIL}
              whatsappNumber={WHATSAPP_NUMBER}
              address={out.address}
              dateFrom={out.dateFrom}
              dateTo={out.dateTo}
              machineId={out.machineId}
            />
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
