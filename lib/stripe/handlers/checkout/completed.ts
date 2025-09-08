// Full-upfront pivot: promote the booking on completion (card immediate),
// and ignore legacy manual-capture auth sessions gracefully.

import type Stripe from "stripe";
import { notifyBookingConfirmed } from "@/lib/notifications/notify-booking-confirmed";
import {
  extractSessionFacts,
  ensurePaymentIntentIdFromSession,
  promoteBookingToConfirmed,
  type LogFn,
} from "@/lib/stripe/webhook-service";

/** Public handler signature used by the registry */
export async function onCheckoutSessionCompleted(
  event: Stripe.Event,
  log: LogFn
): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;

  // Normalize common facts from the Session.
  const { bookingId, flow, paymentIntentId, amountTotalCents } =
    extractSessionFacts(session);

  // If we can’t tie to a booking, log and exit safely.
  if (bookingId == null) {
    log("completed:no_booking_id", {
      client_reference_id: session.client_reference_id,
      metadata: session.metadata,
    });
    return;
  }

  // Legacy safety: we no longer do balance authorizations. Ignore if seen.
  if (flow === "balance_authorize") {
    log("completed:balance_authorize_ignored", {
      bookingId,
      sessionId: session.id,
    });
    return;
  }

  // Full payment (covers legacy "deposit" and new "full_upfront").
  // Ensure we have a PI id; expand if Stripe didn’t include it inline.
  const piId =
    paymentIntentId ?? (await ensurePaymentIntentIdFromSession(session, log));

  log("completed:full_payment_promote", {
    bookingId,
    sessionId: session.id,
    piId: piId ?? null,
    amount_total: amountTotalCents ?? null,
    flow,
  });

  // Idempotent promotion to CONFIRMED + attach PI.
  await promoteBookingToConfirmed({ bookingId, paymentIntentId: piId ?? null }, log);

  // Best-effort notification (non-fatal if it errors).
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
