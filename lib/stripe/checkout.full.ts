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
  /**
   * Subtotal to charge now (euros, pre-VAT).
   * VAT 23% will be applied via a fixed Stripe Tax Rate on the line item.
   */
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
 * VAT is applied using a fixed PT Tax Rate (23%), not Automatic Tax.
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

  // Require a tax rate env to avoid silent mis-taxing in prod.
  const ptVatRateId = process.env.STRIPE_TAX_RATE_PT_STANDARD;
  if (!ptVatRateId) {
    throw new Error(
      "Missing STRIPE_TAX_RATE_PT_STANDARD env var (create a PT VAT 23% Tax Rate and set its txr_… ID)."
    );
  }

  return {
    mode: "payment",

    // Explicit locale avoids Stripe's dynamic locale chunk probe (./en warning).
    locale: "en",

    // Create a Customer so future ops/emails reconcile cleanly.
    customer_creation: "always",
    customer_email: customerEmail,

    // We use a fixed Tax Rate, so Automatic Tax and tax ID collection are disabled.
    // This keeps Checkout minimal and avoids double data entry.
    // automatic_tax: { enabled: true },
    // tax_id_collection: { enabled: true },

    // Keep address collection light now that tax rate is fixed.
    billing_address_collection: "auto",

    // Mirror metadata into Session (PI metadata mirrored by our wrapper).
    metadata: baseMetadata,

    client_reference_id: String(bookingId),

    // Only set payment_method_types when caller passes an override.
    ...(paymentMethodTypes ? { payment_method_types: paymentMethodTypes } : {}),

    // One line item with tax-exclusive pricing; PT VAT 23% is applied via tax_rates.
    line_items: [
      {
        price_data: {
          unit_amount: Math.round(totalEuros * 100), // cents, pre-VAT
          currency: "eur",
          tax_behavior: "exclusive",
          product_data: {
            name: `Rental — ${machine.name}`,
            description: lineDesc(startDate, endDate, days),
          },
        },
        tax_rates: [ptVatRateId],
        quantity: 1,
      },
    ],

    // Return to booking success; cancel returns to machine page.
    success_url: `${appUrl}/booking/success?session_id={CHECKOUT_SESSION_ID}&booking_id=${bookingId}`,
    cancel_url: `${appUrl}/machine/${machine.id}?checkout=cancelled`,
  };
}
