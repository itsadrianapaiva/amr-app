// Single-responsibility handler for `payment_intent.amount_capturable_updated`.
// Keeps logic tiny by delegating to webhook-service helpers.

import type Stripe from "stripe";
import {
  extractPIFacts,
  upsertBalanceAuthorization,
  type LogFn,
} from "@/lib/stripe/webhook-service";

/**
 * onPaymentIntentCapturableUpdated
 * Fired when a manual-capture PI becomes capturable (our auth hold is ready).
 * We only care for flow === 'balance_authorize'; others are ignored.
 */
export async function onPaymentIntentCapturableUpdated(
  event: Stripe.Event,
  log: LogFn
): Promise<void> {
  // 1) Read normalized facts from the PI (bookingId, flow, amount_capturable)
  const pi = event.data.object as Stripe.PaymentIntent;
  const { bookingId, flow, amountCapturableCents } = extractPIFacts(pi);

  // 2) Ignore non-auth flows to avoid noise
  if (flow !== "balance_authorize") {
    log("pi.capturable:ignored_flow", { flow });
    return;
  }

  // 3) If we don't have a booking to attach to, log and exit
  if (!bookingId) {
    log("pi.capturable:no_booking_id", { metadata: pi.metadata });
    return;
  }

  // 4) Persist/refresh the authorization details on the booking
  log("pi.capturable:store_auth", {
    bookingId,
    piId: pi.id,
    amount_capturable: amountCapturableCents,
  });

  await upsertBalanceAuthorization(
    { bookingId, paymentIntentId: pi.id, amountCents: amountCapturableCents },
    log
  );
}
