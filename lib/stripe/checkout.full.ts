// Builds Stripe Checkout Session params for the **FULL** payment flow.
// Pure: no network calls.

import type Stripe from "stripe";
import { isoDate, lineDesc } from "./checkout";

/* Types */

export type CheckoutLineItem = {
  name: string;
  description?: string;
  unitAmountCents: number;
  quantity: number;
};

export type BuildFullSessionArgs = {
  bookingId: number;
  machine: { id: number; name: string };
  from: Date;
  to: Date;
  days: number;
  /**
   * Subtotal to charge now (euros, pre-VAT).
   * This should be the FINAL discounted amount if a discount was applied.
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
  /**
   * Optional discount percentage (0-100) for metadata tracking only.
   * The totalEuros should already reflect the discounted amount.
   */
  discountPercentage?: number;
  /**
   * Optional: original total before discount (for metadata/tracking).
   */
  originalTotalEuros?: number;
  /**
   * Itemized line items for Stripe Checkout (already discounted).
   * Unit amounts are in cents, already discounted if applicable.
   */
  lineItems?: CheckoutLineItem[];
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
    discountPercentage = 0,
    originalTotalEuros,
    lineItems,
  } = args;

  const startDate = isoDate(from);
  const endDate = isoDate(to);

  // Convert to cents and validate it's a non-negative integer
  const totalCents = Math.round(totalEuros * 100);
  const originalTotalCents = originalTotalEuros
    ? Math.round(originalTotalEuros * 100)
    : totalCents;

  if (totalCents < 0) {
    throw new Error(
      `Invalid totalEuros: ${totalEuros}. Cannot create checkout with negative amount.`
    );
  }

  // Debug logging
  if (process.env.LOG_CHECKOUT_DEBUG === "1") {
    console.log("[stripe] buildFullCheckoutSessionParams debug", {
      bookingId,
      totalEuros,
      totalCents,
      discountPercentage,
      originalTotalEuros,
      originalTotalCents,
      lineItemsCount: lineItems?.length ?? 0,
    });
  }

  const baseMetadata = {
    bookingId: String(bookingId),
    machineId: String(machine.id),
    startDate,
    endDate,
    flow: "full_upfront" as const,
    // Add discount tracking to metadata
    ...(discountPercentage > 0
      ? {
          discount_percent: String(discountPercentage),
          original_subtotal_cents: String(originalTotalCents),
          discounted_subtotal_cents: String(totalCents),
        }
      : {}),
  };

  // Require a tax rate env to avoid silent mis-taxing in prod.
  const ptVatRateId = process.env.STRIPE_TAX_RATE_PT_STANDARD;
  if (!ptVatRateId) {
    throw new Error(
      "Missing STRIPE_TAX_RATE_PT_STANDARD env var (create a PT VAT 23% Tax Rate and set its txr_… ID)."
    );
  }

  // Build line items: use itemized if provided, otherwise fall back to legacy single-line
  let stripeLineItems: Stripe.Checkout.SessionCreateParams.LineItem[];

  if (lineItems && lineItems.length > 0) {
    // Itemized line items (new behavior)
    stripeLineItems = lineItems.map((item) => ({
      price_data: {
        unit_amount: item.unitAmountCents,
        currency: "eur",
        tax_behavior: "exclusive" as const,
        product_data: {
          name: item.name,
          ...(item.description ? { description: item.description } : {}),
        },
      },
      tax_rates: [ptVatRateId],
      quantity: item.quantity,
    }));
  } else {
    // Legacy single-line behavior (fallback for backward compatibility)
    stripeLineItems = [
      {
        price_data: {
          unit_amount: totalCents,
          currency: "eur",
          tax_behavior: "exclusive",
          product_data: {
            name: `Rental — ${machine.name}`,
            description:
              discountPercentage > 0
                ? `${lineDesc(startDate, endDate, days)} (${discountPercentage}% partner discount applied)`
                : lineDesc(startDate, endDate, days),
          },
        },
        tax_rates: [ptVatRateId],
        quantity: 1,
      },
    ];
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

    // Enable promotion code input for first-rental discounts (e.g., WELCOME10)
    allow_promotion_codes: true,

    // Mirror metadata into Session (PI metadata mirrored by our wrapper).
    metadata: baseMetadata,

    client_reference_id: String(bookingId),

    // Only set payment_method_types when caller passes an override.
    ...(paymentMethodTypes ? { payment_method_types: paymentMethodTypes } : {}),

    // Use computed line items (itemized or legacy)
    line_items: stripeLineItems,

    // Return to booking success; cancel returns to machine page.
    success_url: `${appUrl}/booking/success?session_id={CHECKOUT_SESSION_ID}&booking_id=${bookingId}`,
    cancel_url: `${appUrl}/machine/${machine.id}?checkout=cancelled`,
  };
}
