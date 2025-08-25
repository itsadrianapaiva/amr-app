// Minimal, focused helper: Stripe singleton + money helpers.
// Keep server-only usage. Do NOT import in client components.

import Stripe from "stripe";

// Small guard to fail fast if env is missing.
function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable: ${name}`);
  return v;
}

// Reuse one Stripe instance across hot reloads (like Prisma).
declare global {
  // eslint-disable-next-line no-var
  var _stripe: Stripe | undefined;
}

/**
 * Get a singleton Stripe client configured from env.
 * Keep this tiny and deterministic so it's safe to import in server code.
 */
export function getStripe(): Stripe {
  if (!globalThis._stripe) {
    globalThis._stripe = new Stripe(requireEnv("STRIPE_SECRET_KEY"), {
      // Optionally pin an API version here if you prefer:
      // apiVersion: "2024-06-20",
    });
  }
  return globalThis._stripe;
}

// ---- Money helpers (euros -> cents) ----

// Stripe expects integer minor units. We store/display euros as numbers.
export const CURRENCY = "eur" as const;

/** Convert a euro amount to integer cents (rounded). */
export function eurToCents(amountInEuros: number): number {
  return Math.round(Number(amountInEuros) * 100);
}

/** Convenience to build Checkout price fields consistently. */
export function toMoney(amountInEuros: number) {
  return {
    unit_amount: eurToCents(amountInEuros),
    currency: CURRENCY,
  } as const;
}
