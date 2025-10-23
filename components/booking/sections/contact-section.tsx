"use client";

import { Control } from "react-hook-form";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { BookingFormValues } from "@/lib/validation/booking";
import PhoneInput from "@/components/forms/phone-input";

type ContactSectionProps = {
  control: Control<BookingFormValues>;
  onNifBlur?: (nif: string) => void;
};

/**
 * ContactSection
 * - Collects customer name, email, phone, and optional personal NIF.
 * - NIF is optional. If provided, schema enforces 9 digits.
 * - Keeps to the "sections accept control only" convention.
 */
export function ContactSection({ control, onNifBlur }: ContactSectionProps) {
  return (
    <div className="space-y-6">
      {/* Name */}
      <FormField
        control={control}
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

      {/* Email */}
      <FormField
        control={control}
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

      {/* Phone (E.164) */}
      <FormField
        control={control}
        name="phone"
        render={({ field }) => (
          <FormItem>
            <FormLabel htmlFor="phone">Phone Number</FormLabel>
            {/* onBlur here captures blur from the select/input inside PhoneInput so RHF marks as touched */}
            <FormControl onBlur={field.onBlur}>
              <PhoneInput
                id="phone"
                name={field.name}
                value={field.value ?? ""} // keep controlled; never undefined
                onChange={(e164) => field.onChange(e164)} // store E.164 like "+351912345678"
                defaultCountry="PT" // change to "US" if you prefer
                placeholder="123 456 789"
                required
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Optional personal NIF (null-safe) */}
      <FormField
        control={control}
        name="customerNIF"
        render={({ field }) => (
          <FormItem>
            <FormLabel htmlFor="customerNIF">NIF (optional)</FormLabel>
            <FormControl>
              <Input
                id="customerNIF"
                inputMode="numeric"
                pattern="\d*"
                maxLength={9}
                placeholder="9 digits"
                {...field}
                /* Ensure value is never null for <input> */
                value={field.value ?? ""}
                onChange={(e) => {
                  const digitsOnly = e.target.value.replace(/\D+/g, "");
                  field.onChange(digitsOnly);
                }}
                onBlur={(e) => {
                  field.onBlur();
                  if (onNifBlur) {
                    onNifBlur(e.target.value);
                  }
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
