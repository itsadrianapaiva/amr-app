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
  /** Total amount to CHARGE now (in euros). */
  totalEuros: number;
  customerEmail: string;
  appUrl: string;
  /**
   * Optional: explicitly control which payment methods to show.
   * If omitted, we default to ["card","mb_way"].
   * Note: To accept MB WAY / SEPA in Checkout, enable them in Dashboard and
   * include their types ( "mb_way", "sepa_debit" ). */
  paymentMethodTypes?: Stripe.Checkout.SessionCreateParams.PaymentMethodType[];
};

/**
 * Build a Stripe Checkout Session that charges the **full rental** upfront.
 * Also creates/links a Stripe Customer for better receipts and ops lookup.
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

  // Default to cards + MB WAY; add SEPA by passing it in paymentMethodTypes when desired.
  const methods =
    paymentMethodTypes && paymentMethodTypes.length > 0
      ? paymentMethodTypes
      : ([
          "card",
          "mb_way",
          "sepa",
        ] as Stripe.Checkout.SessionCreateParams.PaymentMethodType[]);

  return {
    mode: "payment",

    // Create a Customer so future ops/emails reconcile cleanly.
    customer_creation: "always",
    customer_email: customerEmail,

    // Light-touch collection for MVP; can raise later if invoicing rules change.
    billing_address_collection: "auto",
    phone_number_collection: { enabled: false },
    tax_id_collection: { enabled: false },

    // Mirror booking metadata into the Session (and PI via our wrapper).
    metadata: baseMetadata,

    client_reference_id: String(bookingId),

    // Allow the payment methods we want visible in Checkout.
    payment_method_types: methods,

    // Single clear line item for the whole rental.
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
