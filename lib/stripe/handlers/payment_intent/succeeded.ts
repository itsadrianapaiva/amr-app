// Handler for `payment_intent.succeeded`.
// - Deposit flow: promote booking + send emails.
// - Balance auth capture (later by Ops): no booking promotion.

import type Stripe from "stripe";
import { notifyBookingConfirmed } from "@/lib/notifications/notify-booking-confirmed";
import {
  extractPIFacts,
  promoteBookingToConfirmed,
  type LogFn,
} from "@/lib/stripe/webhook-service";

/**
 * onPaymentIntentSucceeded
 * Deposit success → confirm booking.
 * Balance authorization capture → log only (promotion not applicable).
 */
export async function onPaymentIntentSucceeded(
  event: Stripe.Event,
  log: LogFn
): Promise<void> {
  // 1) Normalize facts from the PI (bookingId + flow)
  const pi = event.data.object as Stripe.PaymentIntent;
  const { bookingId, flow } = extractPIFacts(pi);

  // 2) Balance authorization capture (manual capture done later by Ops)
  if (flow === "balance_authorize") {
    log("pi.succeeded:balance_capture", { piId: pi.id });
    return;
  }

  // 3) Deposit flow must tie back to a booking id
  if (!bookingId) {
    log("pi.succeeded:no_booking_id", { metadata: pi.metadata });
    return;
  }

  // 4) Promote booking to CONFIRMED and attach the PI id (idempotent)
  log("pi.succeeded:deposit_promote", { bookingId, piId: pi.id });
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
