// Shared helpers for Stripe Checkout builders.
// Keep this file free of builder code to avoid import cycles.

import { formatISO } from "date-fns";

/** Return YYYY-MM-DD using date-fns to avoid timezone off-by-one issues. */
export function isoDate(d: Date): string {
  return formatISO(d, { representation: "date" });
}

/** Build a human-friendly line item description for Checkout. */
export function lineDesc(start?: string, end?: string, days?: number): string {
  if (!start || !end) return "Remaining balance";
  const plural = typeof days === "number" && days > 1 ? "s" : "";
  const span = typeof days === "number" ? ` (${days} day${plural})` : "";
  return `Dates: ${start} to ${end}${span}`;
}

/** Optional: shape for Stripe Checkout custom submit message (kept Stripe-agnostic). */
export type CheckoutCustomText = {
  custom_text: { submit: { message: string } };
};

/** Return the Checkout submit message object only if a message is provided. */
export function optionalCustomText(message?: string): CheckoutCustomText | {} {
  return message ? { custom_text: { submit: { message } } } : {};
}
