"use-client";

import * as React from "react";
import { useFormContext } from "react-hook-form";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type BillingSectionProps = {
  className?: string;
  onTaxIdBlur?: (taxId: string) => void;
  isCheckingDiscount?: boolean;
  discountPercentage?: number;
};

/**
 * BillingSection
 * - Minimal RHF section to collect company invoicing data when applicable.
 * - If "Booking for a company?" is checked, show Company, Tax ID, and Address fields.
 * - Keeps validation in Zod; only displays error messages from RHF.
 */

export function BillingSection({
  className,
  onTaxIdBlur,
  isCheckingDiscount = false,
  discountPercentage = 0,
}: BillingSectionProps) {
  const {
    register,
    watch,
    formState: { errors },
  } = useFormContext();

  const billingIsBusiness: boolean = watch("billingIsBusiness") ?? false;

  return (
    <section className={cn("mt-8", className)}>
      <h3 className="text-base font-semibold tracking-normal">
        Billing information
      </h3>

      {/* Toggle: booking for a company? */}
      <div className="mt-4 flex items-center justify-between rounded-lg border p-3 ">
        <div>
          <p className="font-medium">Booking for a company?</p>
          <p className="text-sm text-muted-foreground">
            If yes, we will use these details to issue an invoice.
          </p>
        </div>

        {/* Native checkbox keeps RHF simple and avoids a Controller */}
        <input
          type="checkbox"
          className="h-4 w-4 accent-primary space-y-6"
          {...register("billingIsBusiness")}
        />
      </div>

      {/* Conditional business fields */}
      {billingIsBusiness && (
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Company name */}
          <div className="space-y-2">
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
          <div className="space-y-2">
            <Label htmlFor="billingTaxId">Tax ID (NIF/NIPC)</Label>
            <div className="relative">
              <Input
                id="billingTaxId"
                {...register("billingTaxId")}
                onBlur={(e) => {
                  if (onTaxIdBlur) {
                    onTaxIdBlur(e.target.value);
                  }
                }}
              />
              {isCheckingDiscount && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <svg
                    className="animate-spin h-4 w-4 text-gray-500"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                </div>
              )}
              {!isCheckingDiscount && discountPercentage > 0 && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-green-600">
                  <svg
                    className="h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-xs font-medium">{discountPercentage}% discount</span>
                </div>
              )}
            </div>
            {errors?.billingTaxId?.message ? (
              <p className="mt-1 text-xs text-destructive">
                {String(errors.billingTaxId.message)}
              </p>
            ) : null}
          </div>

          {/* Address line 1 */}
          <div className="md:col-span-2 space-y-2">
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
          <div className="space-y-2">
            <Label htmlFor="billingPostalCode">Postal code</Label>
            <Input id="billingPostalCode" {...register("billingPostalCode")} />
            {errors?.billingPostalCode?.message ? (
              <p className="mt-1 text-xs text-destructive">
                {String(errors.billingPostalCode.message)}
              </p>
            ) : null}
          </div>

          {/* City */}
          <div className="space-y-2">
            <Label htmlFor="billingCity">City</Label>
            <Input id="billingCity" {...register("billingCity")} />
            {errors?.billingCity?.message ? (
              <p className="mt-1 text-xs text-destructive">
                {String(errors.billingCity.message)}
              </p>
            ) : null}
          </div>

          {/* Country */}
          <div className="md:col-span-2 space-y-2">
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
