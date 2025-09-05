// Builds Stripe Checkout Session params for the BALANCE AUTHORIZATION (manual-capture) flow.
// Pure: no network calls.

import type Stripe from "stripe";
import { isoDate, lineDesc } from "./checkout";

/* Types */

export type BuildBalanceAuthorizationArgs = {
  bookingId: number;
  machine: { id: number; name: string };

  /** Optional for description shown in Stripe UI */
  from?: Date;
  to?: Date;
  days?: number;

  /** Remaining balance (in euros) to AUTHORIZE now (manual capture later) */
  authorizeEuros: number;
  customerEmail: string;
  appUrl: string;

  /** Bind session to an existing Stripe Customer (keeps identity coherent) */
  customerId?: string;

  /** Allow caller to override success/cancel URLs for customer vs ops contexts */
  successUrlOverride?: string;
  cancelUrlOverride?: string;

  /** Optional copy shown under the submit button to clarify “verification only”. */
  customTextMessage?: string;
};

/**
 * Manual-capture Checkout (authorization only).
 * IMPORTANT: choose exactly ONE of `customer` OR `customer_email` (+customer_creation).
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
    customerId,
    successUrlOverride,
    cancelUrlOverride,
    customTextMessage,
  } = args;

  const startDate = from ? isoDate(from) : undefined;
  const endDate = to ? isoDate(to) : undefined;

  const baseMetadata = {
    bookingId: String(bookingId),
    machineId: String(machine.id),
    flow: "balance_authorize" as const,
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
    ...(typeof days === "number" ? { days: String(days) } : {}),
  };

  const success_url =
    successUrlOverride ??
    `${appUrl}/booking/success?booking_id=${bookingId}&session_id={CHECKOUT_SESSION_ID}&auth=1`;
  const cancel_url =
    cancelUrlOverride ??
    `${appUrl}/machine/${machine.id}?auth_cancelled=1&booking_id=${bookingId}`;

  // Mutually exclusive customer identity
  const customerIdentity = customerId
    ? { customer: customerId }
    : { customer_email: customerEmail, customer_creation: "always" as const };

  // Clear, reassuring copy under the submit button
  const submitMessage =
    customTextMessage ??
    "Verification only — no additional charge today. A temporary hold may appear and will be released if not captured.";

  return {
    mode: "payment",

    // identity (mutually exclusive)
    ...customerIdentity,

    billing_address_collection: "auto",
    phone_number_collection: { enabled: false },
    tax_id_collection: { enabled: false },

    // mirror metadata, manual capture
    metadata: baseMetadata,
    payment_intent_data: {
      capture_method: "manual",
      receipt_email: customerEmail,
      metadata: baseMetadata,
      description: `Card verification (no charge today) for booking ${bookingId}`, // also visible in Stripe UI
    },

    client_reference_id: String(bookingId),

    // Force card-only so users don't see non-holdable methods
    payment_method_types: ["card"],

    // Crystal-clear line item name to avoid “second charge” perception
    line_items: [
      {
        price_data: {
          unit_amount: Math.round(authorizeEuros * 100),
          currency: "eur",
          product_data: {
            name: `Card verification — balance authorization for ${machine.name} (no charge today)`,
            description: lineDesc(startDate, endDate, days),
          },
        },
        quantity: 1,
      },
    ],

    // Copy shown under the submit button on the Checkout page
    custom_text: { submit: { message: submitMessage } },

    success_url,
    cancel_url,
  };
}
