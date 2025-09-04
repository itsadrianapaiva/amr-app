//add whatsapp to geofence error banner.
"use client";

import * as React from "react";
import { addDays } from "date-fns";

import type { SerializableMachine } from "@/lib/types";
import type { BookingFormValues } from "@/lib/validation/booking";
import type { DisabledRangeJSON } from "@/lib/availability";

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
import { useDatePolicy } from "@/lib/hooks/use-date-policy";
import { useAddonToggles } from "@/lib/hooks/use-addon-toggles";
import { startOfLisbonDayUTC } from "@/lib/dates/lisbon";

const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@example.com";

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

  // 2) Date policy — Lisbon-aware minStart (heavy machines 5/6/7 get 2 days + 15:00 cutoff)
  const { minStart, schema } = useDatePolicy({
    minDays,
    machineId: machine.id,
  });

  // 3) RHF setup via centralized logic (pass minStart so calendar blocks early dates)
  const { form, rentalDays, disabledDays } = useBookingFormLogic({
    schema,
    disabledRangesJSON,
    minStart, // key:enforce the heavy-machine earliest start in the UI
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
      errors: form.formState.errors as any,
      rentalDays,
      minDays,
    });

  // 7) Dynamic helper text: show heavy-transport earliest date when stricter than “tomorrow”
  const helperText = React.useMemo(() => {
    const tomorrowLisbon = addDays(startOfLisbonDayUTC(new Date()), 1);
    const isHeavy = new Set([5, 6, 7]).has(machine.id);
    const heavyRuleApplies =
      isHeavy && minStart.getTime() > tomorrowLisbon.getTime();

    if (heavyRuleApplies) {
      const friendly = minStart.toLocaleDateString("en-GB", {
        timeZone: "Europe/Lisbon",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      return `Earliest start is ${friendly} for heavy-transport machines.`;
    }
    return "Earliest start is tomorrow. Same-day rentals are not available.";
  }, [machine.id, minStart]);

  // 8) Submit handler (server action) — creates PENDING booking and opens Stripe
  async function baseOnSubmit(values: BookingFormValues) {
    const payload = { ...values, machineId: machine.id };

    try {
      // The action now returns a union: { ok:true, url } | { ok:false, formError }
      const res: any = await createDepositCheckoutAction(payload);

      if (res?.ok) {
        // Success → redirect to Stripe Checkout
        window.location.assign(res.url);
        return;
      }

      // Friendly banner message (uses your existing ErrorSummary via rootError)
      const message =
        res?.formError ??
        "Selected dates are currently unavailable. Please try another range.";
      form.setError("root", { type: "server", message });
    } catch (err) {
      // Network/unknown exception fallback
      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong creating the checkout.";
      form.setError("root", { type: "server", message });
    }
  }

  // 9) Opt-out gating (keeps UX logic out of presenter)
  const { dialogOpen, setDialogOpen, missing, onSubmitAttempt, onConfirm } =
    useOptOutGate({
      insuranceOn: !!insuranceSelected,
      deliveryOn: !!deliverySelected,
      pickupOn: !!pickupSelected,
      operatorOn: !!operatorSelected,
      onProceed: baseOnSubmit,
    });

  // 10) Derived flags for presenter
  const isSubmitDisabled =
    form.formState.isSubmitting || rentalDays === 0 || isDateInvalid;

  // 10.1) Detect "out of area" and build a mailto link (compact, dependency-free).
  const rootErrorMessage = form.formState.errors.root?.message ?? null;

  const isOutOfArea = React.useMemo(() => {
    if (typeof rootErrorMessage !== "string") return false;
    // Match the server-side text: "outside our current service area"
    return rootErrorMessage
      .toLowerCase()
      .includes("outside our current service area");
  }, [rootErrorMessage]);

  // Build a readable address string from the current form values for the email body
  const addressObj = form.getValues().siteAddress as
    | string
    | { line1?: string; postalCode?: string; city?: string; notes?: string }
    | undefined;

  const addressStr =
    typeof addressObj === "string"
      ? addressObj
      : [
          addressObj?.line1,
          addressObj?.postalCode,
          addressObj?.city,
          "Portugal",
        ]
          .filter(Boolean)
          .join(", ");

  // Also include selected dates for context (best-effort, empty if unset)
  const picked = form.getValues().dateRange as
    | { from?: Date | null; to?: Date | null }
    | undefined;

  function fmt(d?: Date | null) {
    return d
      ? d.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          timeZone: "Europe/Lisbon",
        })
      : "";
  }

  const subject = "Rental request outside service area";
  const bodyLines = [
    "Hello AMR,",
    "",
    "We’d like to rent outside your current service area.",
    `Address: ${addressStr}`,
    `Dates: ${fmt(picked?.from)} → ${fmt(picked?.to)}`,
    `Machine ID: ${machine.id}`,
    "",
    "Could you advise on availability or a partner referral?",
  ];
  const mailtoHref = `mailto:${encodeURIComponent(
    SUPPORT_EMAIL
  )}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
    bodyLines.join("\n")
  )}`;

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
              rootError={form.formState.errors.root?.message ?? null}
            />
            {isOutOfArea && (
              <div
                role="alert"
                className="mt-4 rounded-lg border border-red-700 bg-red-50 p-4 text-sm"
              >
                <p className="font-medium">Outside our service area</p>
                <p className="mt-1">
                  We currently serve Algarve up to Faro and the Alentejo coastal
                  strip (Sines → Zambujeira do Mar). For exceptions or
                  referrals, contact us:
                </p>
                <div className="mt-3">
                  <a
                    href={mailtoHref}
                    className="inline-flex items-center rounded-md border border-primary-foreground px-3 py-2 text-sm font-medium hover:bg-white"
                  >
                    Email Support ({SUPPORT_EMAIL})
                  </a>
                </div>
              </div>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
