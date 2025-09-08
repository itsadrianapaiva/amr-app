// Builds Stripe Checkout Session params for the **FULL** payment flow.
// Pure: no network calls.

import type Stripe from "stripe";
import { isoDate, lineDesc } from "./checkout";

/* Types */

export type BuildFullSessionArgs = {
  bookingId: number;
  machine: { id: number; name: string };
  from: Date;
  to: Date;
  days: number;
  /** Total amount to CHARGE now (euros, pre-tax; Stripe Tax will add VAT). */
  totalEuros: number;
  customerEmail: string;
  appUrl: string;
  /**
   * Optional explicit override for payment methods.
   * If omitted, Checkout will dynamically show all eligible methods you enabled
   * in the Dashboard (e.g., card, MB WAY, SEPA Direct Debit).
   */
  paymentMethodTypes?: Stripe.Checkout.SessionCreateParams.PaymentMethodType[];
};

/**
 * Build a Stripe Checkout Session that charges the full rental upfront.
 * VAT is computed automatically by Stripe Tax. We collect tax IDs.
 */
export function buildFullCheckoutSessionParams(
  args: BuildFullSessionArgs
): Stripe.Checkout.SessionCreateParams {
  const {
    bookingId,
    machine,
    from,
    to,
    days,
    totalEuros,
    customerEmail,
    appUrl,
    paymentMethodTypes,
  } = args;

  const startDate = isoDate(from);
  const endDate = isoDate(to);

  const baseMetadata = {
    bookingId: String(bookingId),
    machineId: String(machine.id),
    startDate,
    endDate,
    flow: "full_upfront" as const,
  };

  return {
    mode: "payment",

    // Create a Customer so future ops/emails reconcile cleanly.
    customer_creation: "always",
    customer_email: customerEmail,

    // VAT collection
    automatic_tax: { enabled: true }, // Stripe calculates VAT
    tax_id_collection: { enabled: true }, // Collect VAT number when applicable

    // Collect enough address info for tax. Required works best for EU VAT.
    billing_address_collection: "required",

    // Mirror metadata into Session (PI metadata mirrored by our wrapper).
    metadata: baseMetadata,

    client_reference_id: String(bookingId),

    // Only set payment_method_types when caller passes an override.
    ...(paymentMethodTypes ? { payment_method_types: paymentMethodTypes } : {}),

    // One line item, Stripe Tax adds VAT on top.
    line_items: [
      {
        price_data: {
          unit_amount: Math.round(totalEuros * 100),
          currency: "eur",
          product_data: {
            name: `Rental — ${machine.name}`,
            description: lineDesc(startDate, endDate, days),
          },
        },
        quantity: 1,
      },
    ],

    // Return to booking success; cancel returns to machine page.
    success_url: `${appUrl}/booking/success?session_id={CHECKOUT_SESSION_ID}&booking_id=${bookingId}`,
    cancel_url: `${appUrl}/machine/${machine.id}?checkout=cancelled`,
  };
}
