import type Stripe from "stripe";
import { formatISO } from "date-fns";
import { toMoney } from "@/lib/stripe";

/**
 * Build a single, canonical Checkout Session payload for the DEPOSIT.
 * - Charges DEPOSIT only (minor units via toMoney()).
 * - Puts booking metadata on BOTH Session and PaymentIntent.
 * - Adds human-friendly product name/description for Stripe UI clarity.
 */
export function buildDepositCheckoutSessionParams(args: {
  bookingId: number;
  machine: { id: number; name: string };
  from: Date;
  to: Date;
  days: number;
  depositEuros: number;
  customerEmail: string;
  appUrl: string;
}): Stripe.Checkout.SessionCreateParams {
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
