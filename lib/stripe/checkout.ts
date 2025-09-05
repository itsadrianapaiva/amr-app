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
Saves the card on deposit only.
If the issuer later demands SCA for the hold, the off-session attempt will fail gracefully and we’ll fallback to our existing authorization Checkout (card-only).
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

  const baseMetadata = {
    bookingId: String(bookingId),
    machineId: String(machine.id),
    startDate,
    endDate,
  };

  return {
    mode: "payment",
    customer_creation: "always", // ensure a Customer exists so the card can be saved
    billing_address_collection: "auto",
    phone_number_collection: { enabled: false },
    tax_id_collection: { enabled: false },

    customer_email: customerEmail,

    // Mirror metadata + SAVE CARD for future off-session use
    metadata: baseMetadata,
    payment_intent_data: {
      metadata: baseMetadata,
      receipt_email: customerEmail,
      // ⬇️ NEW: save the card for off-session (lets us try a silent authorization later)
      setup_future_usage: "off_session",
    },

    client_reference_id: String(bookingId),

    line_items: [
      {
        price_data: {
          ...toMoney(depositEuros),
          product_data: {
            name: `Booking deposit - ${machine.name}`,
            description:
              `Dates: ${startDate} to ${endDate}` +
              (typeof days === "number"
                ? ` (${days} day${days > 1 ? "s" : ""})`
                : ""),
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
  /** Optional for description shown in Stripe UI */
  from?: Date;
  to?: Date;
  days?: number;
  /** Remaining balance (in euros) to AUTHORIZE now (manual capture later) */
  authorizeEuros: number;
  customerEmail: string;
  appUrl: string;
};

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

    // Card-only so manual capture works (prevents MB WAY/Multibanco here).
    payment_method_types: ["card"],

    customer_creation: "always",
    billing_address_collection: "auto",
    phone_number_collection: { enabled: false },
    tax_id_collection: { enabled: false },

    customer_email: customerEmail,

    metadata: baseMetadata,
    payment_intent_data: {
      capture_method: "manual", // Authorization (hold), not capture
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

    // ⬇️ On auth success, hand off to a customer route that will start the deposit Checkout.
    success_url: `${appUrl}/booking/authorize-success?booking_id=${bookingId}&session_id={CHECKOUT_SESSION_ID}`,

    // ⬇️ On cancel, return customer to the machine page (same as the deposit flow).
    cancel_url: `${appUrl}/machine/${machine.id}?checkout=cancelled`,
  };
}
