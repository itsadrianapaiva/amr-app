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
