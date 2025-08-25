"use-client";

import * as React from "react";
import { useFormContext } from "react-hook-form";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type BillingSectionProps = {
  className?: string;
};

/**
 * BillingSection
 * - Minimal RHF section to collect company invoicing data when applicable.
 * - If "Booking for a company?" is checked, show Company, Tax ID, and Address fields.
 * - Keeps validation in Zod; only displays error messages from RHF.
 */

export function BillingSection({ className }: BillingSectionProps) {
  const {
    register,
    watch,
    formState: { errors },
  } = useFormContext();

  const billingIsBusiness: boolean = watch("billingIsBusiness") ?? false;

  return (
    <section className={cn("mt-8", className)}>
      <h3 className="text-base font-semibold tracking-tight">
        Billing information
      </h3>

      {/* Toggle: booking for a company? */}
      <div className="mt-4 flex items-center justify-between rounded-lg border p-3">
        <div>
          <p className="font-medium">Booking for a company?</p>
          <p className="text-sm text-muted-foreground">
            If yes, we will use these details to issue an invoice.
          </p>
        </div>

        {/* Native checkbox keeps RHF simple and avoids a Controller */}
        <input
          type="checkbox"
          className="h-4 w-4 accent-primary"
          {...register("billingIsBusiness")}
        />
      </div>

      {/* Conditional business fields */}
      {billingIsBusiness && (
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Company name */}
          <div>
            <Label htmlFor="billingCompanyName">Company name</Label>
            <Input
              id="billingCompanyName"
              {...register("billingCompanyName")}
            />
            {errors?.billingCompanyName?.message ? (
              <p className="mt-1 text-xs text-destructive">
                {String(errors.billingCompanyName.message)}
              </p>
            ) : null}
          </div>

          {/* Tax ID (NIF/NIPC) */}
          <div>
            <Label htmlFor="billingTaxId">Tax ID (NIF/NIPC)</Label>
            <Input id="billingTaxId" {...register("billingTaxId")} />
            {errors?.billingTaxId?.message ? (
              <p className="mt-1 text-xs text-destructive">
                {String(errors.billingTaxId.message)}
              </p>
            ) : null}
          </div>

          {/* Address line 1 */}
          <div className="md:col-span-2">
            <Label htmlFor="billingAddressLine1">Address line 1</Label>
            <Input
              id="billingAddressLine1"
              {...register("billingAddressLine1")}
            />
            {errors?.billingAddressLine1?.message ? (
              <p className="mt-1 text-xs text-destructive">
                {String(errors.billingAddressLine1.message)}
              </p>
            ) : null}
          </div>

          {/* Postal code */}
          <div>
            <Label htmlFor="billingPostalCode">Postal code</Label>
            <Input id="billingPostalCode" {...register("billingPostalCode")} />
            {errors?.billingPostalCode?.message ? (
              <p className="mt-1 text-xs text-destructive">
                {String(errors.billingPostalCode.message)}
              </p>
            ) : null}
          </div>

          {/* City */}
          <div>
            <Label htmlFor="billingCity">City</Label>
            <Input id="billingCity" {...register("billingCity")} />
            {errors?.billingCity?.message ? (
              <p className="mt-1 text-xs text-destructive">
                {String(errors.billingCity.message)}
              </p>
            ) : null}
          </div>

          {/* Country */}
          <div className="md:col-span-2">
            <Label htmlFor="billingCountry">Country</Label>
            <Input id="billingCountry" {...register("billingCountry")} />
            {errors?.billingCountry?.message ? (
              <p className="mt-1 text-xs text-destructive">
                {String(errors.billingCountry.message)}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}

export default BillingSection;
