// File: lib/stripe/checkout.ts
// Pure builders for Stripe Checkout Session params (no network calls).
// Keep functions tiny, predictable, and testable. Server-only import recommended.

import type Stripe from "stripe";
import { formatISO } from "date-fns";
import { toMoney } from "@/lib/stripe";

/* ---------------------------- small helpers ---------------------------- */

function isoDate(d: Date) {
  return formatISO(d, { representation: "date" });
}

function lineDesc(start?: string, end?: string, days?: number) {
  if (!start || !end) return "Remaining balance";
  const span =
    typeof days === "number" ? ` (${days} day${days > 1 ? "s" : ""})` : "";
  return `Dates: ${start} to ${end}${span}`;
}

/* ------------------------------- DEPOSIT ------------------------------- */

export type BuildDepositSessionArgs = {
  bookingId: number;
  machine: { id: number; name: string };
  from: Date;
  to: Date;
  days: number;
  depositEuros: number;
  customerEmail: string;
  appUrl: string;
};

/**
 * buildDepositCheckoutSessionParams
 * - Charges **deposit only**.
 * - Mirrors booking metadata to both Session and PaymentIntent.
 * - Adds clear product name/description for Stripe UI.
 */
export function buildDepositCheckoutSessionParams(
  args: BuildDepositSessionArgs
): Stripe.Checkout.SessionCreateParams {
  const {
    bookingId,
    machine,
    from,
    to,
    days,
    depositEuros,
    customerEmail,
    appUrl,
  } = args;

  const startDate = isoDate(from);
  const endDate = isoDate(to);

  // Single source of truth for metadata (webhook relies on bookingId here)
  const baseMetadata = {
    bookingId: String(bookingId),
    machineId: String(machine.id),
    startDate,
    endDate,
  };

  return {
    mode: "payment",
    customer_creation: "always",
    billing_address_collection: "auto",
    phone_number_collection: { enabled: false },
    tax_id_collection: { enabled: false },

    customer_email: customerEmail,

    // Mirror metadata to PI for reconciliation & webhooks
    metadata: baseMetadata,
    payment_intent_data: {
      metadata: baseMetadata,
      receipt_email: customerEmail,
    },

    client_reference_id: String(bookingId),

    line_items: [
      {
        price_data: {
          ...toMoney(depositEuros), // euros -> minor units
          product_data: {
            name: `Booking deposit - ${machine.name}`,
            description: lineDesc(startDate, endDate, days),
          },
        },
        quantity: 1,
      },
    ],

    success_url: `${appUrl}/booking/success?session_id={CHECKOUT_SESSION_ID}&booking_id=${bookingId}`,
    cancel_url: `${appUrl}/machine/${machine.id}?checkout=cancelled`,
  };
}

/* ----------------------- BALANCE AUTHORIZATION (HOLD) ------------------ */

export type BuildBalanceAuthorizationArgs = {
  bookingId: number;
  machine: { id: number; name: string };
  /** Optional for display clarity */
  from?: Date;
  to?: Date;
  days?: number;
  /** Amount to authorize now (remaining balance, euros) */
  authorizeEuros: number;
  customerEmail: string;
  appUrl: string;
};

/**
 * buildBalanceAuthorizationCheckoutSessionParams
 * - **Authorization only** (manual capture).
 * - Flags flow to webhook via metadata.flow = 'balance_authorize'.
 * - Mirrors metadata to Session and PaymentIntent.
 */
export function buildBalanceAuthorizationCheckoutSessionParams(
  args: BuildBalanceAuthorizationArgs
): Stripe.Checkout.SessionCreateParams {
  const {
    bookingId,
    machine,
    from,
    to,
    days,
    authorizeEuros,
    customerEmail,
    appUrl,
  } = args;

  const startDate = from ? isoDate(from) : undefined;
  const endDate = to ? isoDate(to) : undefined;

  // Webhook flow marker + booking facts
  const baseMetadata = {
    bookingId: String(bookingId),
    machineId: String(machine.id),
    flow: "balance_authorize" as const,
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
    ...(typeof days === "number" ? { days: String(days) } : {}),
  };

  return {
    mode: "payment",
    customer_creation: "always",
    billing_address_collection: "auto",
    phone_number_collection: { enabled: false },
    tax_id_collection: { enabled: false },

    customer_email: customerEmail,

    // Mirror metadata & switch to manual capture for an authorization (hold)
    metadata: baseMetadata,
    payment_intent_data: {
      capture_method: "manual",
      receipt_email: customerEmail,
      metadata: baseMetadata,
    },

    client_reference_id: String(bookingId),

    line_items: [
      {
        price_data: {
          ...toMoney(authorizeEuros),
          product_data: {
            name: `Balance authorization - ${machine.name}`,
            description: lineDesc(startDate, endDate, days),
          },
        },
        quantity: 1,
      },
    ],

    // Ops/dev-friendly success target; does NOT promote a booking
    success_url: `${appUrl}/ops/success?booking_id=${bookingId}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/ops?auth=cancelled&booking_id=${bookingId}`,
  };
}
