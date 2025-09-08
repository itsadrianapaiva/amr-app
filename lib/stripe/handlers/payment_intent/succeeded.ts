// - Promote the booking (idempotent), attach PI, notify.
// - Ignore legacy manual-capture auth flow safely.

import type Stripe from "stripe";
import { notifyBookingConfirmed } from "@/lib/notifications/notify-booking-confirmed";
import {
  extractPIFacts,
  promoteBookingToConfirmed,
  type LogFn,
} from "@/lib/stripe/webhook-service";

/**
 * onPaymentIntentSucceeded
 * Primary path for card (immediate) success.
 * Async methods (MB WAY / SEPA) are primarily handled by
 * `checkout.session.async_payment_succeeded`, but this remains
 * as a robust backstop (idempotent).
 */
export async function onPaymentIntentSucceeded(
  event: Stripe.Event,
  log: LogFn
): Promise<void> {
  // 1) Normalize facts from the PI (bookingId + flow)
  const pi = event.data.object as Stripe.PaymentIntent;
  const { bookingId, flow } = extractPIFacts(pi);

  // 2) Legacy safety: ignore manual-capture auth flow
  if (flow === "balance_authorize") {
    log("pi.succeeded:balance_authorize_ignored", { piId: pi.id });
    return;
  }

  // 3) If we can’t tie to a booking, log and exit safely
  if (!bookingId) {
    log("pi.succeeded:no_booking_id", { metadata: pi.metadata });
    return;
  }

  // 4) Promote booking to CONFIRMED and attach the PI id (idempotent)
  log("pi.succeeded:full_payment_promote", { bookingId, piId: pi.id });
  await promoteBookingToConfirmed({ bookingId, paymentIntentId: pi.id }, log);

  // 5) Notify customer (best-effort; non-fatal on error)
  log("notify:start", { bookingId, SEND_EMAILS: process.env.SEND_EMAILS });
  try {
    await notifyBookingConfirmed(bookingId, "customer");
    log("notify:done", { bookingId });
  } catch (err) {
    log("notify:error", {
      bookingId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}
