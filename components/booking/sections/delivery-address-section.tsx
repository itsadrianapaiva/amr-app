"use client";

import { Control } from "react-hook-form";
import { Input } from "@/components/ui/input";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import type { BookingFormValues } from "@/lib/validation/booking";

type DeliveryAddressSectionProps = {
  control: Control<BookingFormValues>;
};

/**
 * DeliveryAddressSection
 * - Operational address for drop-off/pick-up (not invoicing).
 * - Shown only when delivery is selected (parent controls visibility).
 * - Follows the "sections accept control only" convention.
 */
export default function DeliveryAddressSection({
  control,
}: DeliveryAddressSectionProps) {
  return (
    <div className="grid gap-4 space-y-2">
      {/* Address line 1 */}
      <FormField
        control={control}
        name="siteAddress.line1"
        render={({ field }) => (
          <FormItem>
            <FormLabel htmlFor="siteAddress.line1">Site address</FormLabel>
            <FormControl>
              <Input
                id="siteAddress.line1"
                placeholder="Street and number"
                autoComplete="address-line1"
                {...field}
                value={field.value ?? ""}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Postal code */}
      <FormField
        control={control}
        name="siteAddress.postalCode"
        render={({ field }) => (
          <FormItem>
            <FormLabel htmlFor="siteAddress.postalCode">Postal code</FormLabel>
            <FormControl>
              <Input
                id="siteAddress.postalCode"
                placeholder="1000-001"
                autoComplete="postal-code"
                {...field}
                value={field.value ?? ""}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* City */}
      <FormField
        control={control}
        name="siteAddress.city"
        render={({ field }) => (
          <FormItem>
            <FormLabel htmlFor="siteAddress.city">City</FormLabel>
            <FormControl>
              <Input
                id="siteAddress.city"
                placeholder="Lisbon"
                autoComplete="address-level2"
                {...field}
                value={field.value ?? ""}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Optional notes for the driver */}
      <FormField
        control={control}
        name="siteAddress.notes"
        render={({ field }) => (
          <FormItem>
            <FormLabel htmlFor="siteAddress.notes">
              Notes for driver (optional)
            </FormLabel>
            <FormControl>
              <Input
                id="siteAddress.notes"
                placeholder="Access notes, gate code, preferred time window…"
                {...field}
                value={field.value ?? ""}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
