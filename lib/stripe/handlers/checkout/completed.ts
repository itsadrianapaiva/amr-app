// Single-responsibility handler for `checkout.session.completed`.
// Kept small by delegating to webhook-service helpers.

import type Stripe from "stripe";
import { notifyBookingConfirmed } from "@/lib/notifications/notify-booking-confirmed";
import {
  extractSessionFacts,
  ensurePaymentIntentIdFromSession,
  promoteBookingToConfirmed,
  upsertBalanceAuthorization,
  type LogFn,
} from "@/lib/stripe/webhook-service";

/** Public handler signature used by the registry */
export async function onCheckoutSessionCompleted(
  event: Stripe.Event,
  log: LogFn
): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;

  // Read facts (bookingId, flow, PI id if present, total) from the session
  const { bookingId, flow, paymentIntentId, amountTotalCents } =
    extractSessionFacts(session);

  // If for any reason we can't tie to a booking, we short-circuit and log
  if (bookingId == null) {
    log("completed:no_booking_id", {
      client_reference_id: session.client_reference_id,
      metadata: session.metadata,
    });
    return;
  }

  // Authorization flow (manual capture, card-only)
  if (flow === "balance_authorize") {
    // Ensure we have a PI id (expand if Stripe didn’t include it inline)
    const piId =
      paymentIntentId ?? (await ensurePaymentIntentIdFromSession(session, log));

    log("completed:balance_authorize", {
      bookingId,
      sessionId: session.id,
      piId: piId ?? null,
      amount_total: amountTotalCents ?? null,
    });

    // Store/refresh the authorization on the booking (PI id + amount)
    await upsertBalanceAuthorization(
      { bookingId, paymentIntentId: piId, amountCents: amountTotalCents },
      log
    );
    return;
  }

  // Deposit flow (capture): promote + notify
  log("completed:deposit_promote", {
    bookingId,
    sessionId: session.id,
    piId: paymentIntentId ?? null,
  });

  await promoteBookingToConfirmed({ bookingId, paymentIntentId }, log);

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
