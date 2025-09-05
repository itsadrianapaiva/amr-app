// Single-responsibility handler for `payment_intent.payment_failed`.
// Business rule: any failure before confirmation cancels the pending booking.

import type Stripe from "stripe";
import {
  extractPIFacts,
  cancelPendingBooking,
  type LogFn,
} from "@/lib/stripe/webhook-service";

/**
 * onPaymentIntentFailed
 * - Fires when a card attempt fails (auth or deposit).
 * - We cancel the PENDING booking to free dates and force a clean retry.
 */
export async function onPaymentIntentFailed(
  event: Stripe.Event,
  log: LogFn
): Promise<void> {
  // 1) Normalize facts (bookingId, flow) from the PI metadata
  const pi = event.data.object as Stripe.PaymentIntent;
  const { bookingId, flow } = extractPIFacts(pi);

  // 2) If we can't tie this to a booking, just log and exit
  if (!bookingId) {
    log("pi.failed:no_booking_id", { metadata: pi.metadata });
    return;
  }

  // 3) Cancel the pending booking (idempotent; only affects PENDING)
  log("pi.failed:cancel_booking", { bookingId, flow, piId: pi.id });
  await cancelPendingBooking(bookingId, log);

  // Note: For deposit failures after a successful auth, we could also actively
  // cancel the auth PI to release the hold early. MVP: let it expire naturally.
}
