// Pure builder for Stripe Checkout Session params (deposit-only).
// Keeps the action tiny and prevents duplicate/contradictory metadata.
// Server-only import recommended.

import type Stripe from "stripe";
import { formatISO } from "date-fns";
import { toMoney } from "@/lib/stripe";

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
 * Build a single, canonical Checkout Session payload:
 * - Charges DEPOSIT only (minor units via toMoney()).
 * - Sets BOTH session.metadata and payment_intent_data.metadata from the same object.
 * - Adds human-friendly product name/description for Stripe UI clarity.
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

  const startDate = formatISO(from, { representation: "date" });
  const endDate = formatISO(to, { representation: "date" });

  // Single source of truth: reused for Session + PaymentIntent
  const baseMetadata = {
    bookingId: String(bookingId),
    machineId: String(machine.id),
    startDate,
    endDate,
    flow: "deposit",
  };

  return {
    mode: "payment",
    customer_creation: "always",
    billing_address_collection: "auto",
    phone_number_collection: { enabled: false },
    tax_id_collection: { enabled: false },

    customer_email: customerEmail,

    // Both Session + Payment Intent share the same metadata
    metadata: baseMetadata,
    payment_intent_data: {
      metadata: baseMetadata,
      // Email receipt on successful charge
      receipt_email: customerEmail,
    },

    client_reference_id: String(bookingId),

    line_items: [
      {
        price_data: {
          ...toMoney(depositEuros),
          product_data: {
            name: `Booking deposit - ${machine.name}`,
            description: `Dates: ${startDate} to ${endDate} (${days} day${
              days > 1 ? "s" : ""
            })`,
          },
        },
        quantity: 1,
      },
    ],

    success_url: `${appUrl}/booking/success?session_id={CHECKOUT_SESSION_ID}&booking_id=${bookingId}`,
    cancel_url: `${appUrl}/machine/${machine.id}?checkout=cancelled`,
  };
}

/*  Payments v2: Manual Capture (Balance)  */

export type BuildBalanceAuthSessionArgs = {
  bookingId: number;
  machine: { id: number; name: string };
  from: Date;
  to: Date;
  days: number;
  /** Amount to authorize now and capture at return/closeout (euros). */
  authorizeEuros: number;
  customerEmail: string;
  appUrl: string;
};

/**
 * buildBalanceAuthorizationSessionParams
 * Creates a Checkout Session that AUTHORIZES (does not capture) the remaining balance.
 * We set `payment_intent_data.capture_method = 'manual'` so the PI is authorized now
 * and can be captured later from the Ops flow.
 *
 * Notes:
 * - We do not compute the amount here; pass the final `authorizeEuros`.
 * - Metadata includes `flow: 'balance_authorize'` to simplify webhook routing.
 */
export function buildBalanceAuthorizationSessionParams(
  args: BuildBalanceAuthSessionArgs
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

  const startDate = formatISO(from, { representation: "date" });
  const endDate = formatISO(to, { representation: "date" });

  const baseMetadata = {
    bookingId: String(bookingId),
    machineId: String(machine.id),
    startDate,
    endDate,
    flow: "balance_authorize",
  };

  return {
    mode: "payment",
    customer_creation: "always",
    billing_address_collection: "auto",
    phone_number_collection: { enabled: false },
    tax_id_collection: { enabled: false },

    customer_email: customerEmail,

    metadata: baseMetadata,
    payment_intent_data: {
      metadata: baseMetadata,
      capture_method: "manual", // <-- authorize now, capture later
      receipt_email: customerEmail,
    },

    client_reference_id: String(bookingId),

    line_items: [
      {
        price_data: {
          ...toMoney(authorizeEuros),
          product_data: {
            name: `Remaining balance authorization - ${machine.name}`,
            description: `Dates: ${startDate} to ${endDate} (${days} day${
              days > 1 ? "s" : ""
            })`,
          },
        },
        quantity: 1,
      },
    ],

    // We return to success to store PI id from the session if webhook lags.
    success_url: `${appUrl}/booking/success?session_id={CHECKOUT_SESSION_ID}&booking_id=${bookingId}&flow=balance_authorize`,
    cancel_url: `${appUrl}/machine/${machine.id}?checkout=cancelled`,
  };
}