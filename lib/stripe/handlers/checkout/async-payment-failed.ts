// Full-upfront flow:
// - Ignore legacy manual-capture auth sessions.
// - Cancel the PENDING booking so dates free up and the user can retry cleanly.

import type Stripe from "stripe";
import {
  extractSessionFacts,
  cancelPendingBooking,
  type LogFn,
} from "@/lib/stripe/webhook-service";

/** Public handler used by the registry */
export async function onCheckoutSessionAsyncPaymentFailed(
  event: Stripe.Event,
  log: LogFn
): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;
  const { bookingId, flow } = extractSessionFacts(session);

  // If we cannot tie the session to a booking, log and exit safely.
  if (bookingId == null) {
    log("async_failed:no_booking_id", {
      client_reference_id: session.client_reference_id,
      metadata: session.metadata,
    });
    return;
  }

  // Legacy safety: we no longer support manual-capture authorizations.
  if (flow === "balance_authorize") {
    log("async_failed:balance_authorize_ignored", {
      bookingId,
      sessionId: session.id,
    });
    return;
  }

  // Cancel the still-pending booking (idempotent).
  await cancelPendingBooking(bookingId, log);
}
