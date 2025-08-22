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

type ContactSectionProps = {
  /** RHF control from the parent form */
  control: Control<any>;
};

/**
 * ContactSection
 * Encapsulates name, email, and phone fields.
 * - No schema or validation logic here
 * - Pure presentational RHF fields
 */
export function ContactSection({ control }: ContactSectionProps) {
  return (
    <div className="space-y-6">
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

      <FormField
        control={control}
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
    </div>
  );
}
