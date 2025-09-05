// Handler for `checkout.session.expired`.
// Business rule: if the session expires before payment/auth, cancel the PENDING booking.

import type Stripe from "stripe";
import {
  extractSessionFacts,
  cancelPendingBooking,
  type LogFn,
} from "@/lib/stripe/webhook-service";

/**
 * onCheckoutSessionExpired
 * Cancels the booking when the customer abandons or times out in Checkout.
 */
export async function onCheckoutSessionExpired(
  event: Stripe.Event,
  log: LogFn
): Promise<void> {
  // 1) Normalize: get bookingId from session metadata or client_reference_id
  const session = event.data.object as Stripe.Checkout.Session;
  const { bookingId } = extractSessionFacts(session);

  // 2) If we cannot resolve a booking id, just log/exit (nothing to cancel)
  if (bookingId == null) {
    log("expired:no_booking_id", {
      client_reference_id: session.client_reference_id,
      metadata: session.metadata,
    });
    return;
  }

  // 3) Cancel PENDING booking (idempotent; CONFIRMED stays untouched)
  await cancelPendingBooking(bookingId, log);
}
