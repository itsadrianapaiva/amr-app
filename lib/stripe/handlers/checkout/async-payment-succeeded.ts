// Full-upfront pivot:
// - Ignore legacy manual-capture auth sessions.
// - Promote the booking to CONFIRMED on async success (MB WAY / SEPA), attach PI, notify.

import type Stripe from "stripe";
import { notifyBookingConfirmed } from "@/lib/notifications/notify-booking-confirmed";
import {
  extractSessionFacts,
  ensurePaymentIntentIdFromSession,
  promoteBookingToConfirmed,
  type LogFn,
} from "@/lib/stripe/webhook-service";

/** Public handler used by the registry */
export async function onCheckoutSessionAsyncPaymentSucceeded(
  event: Stripe.Event,
  log: LogFn
): Promise<void> {
  // 1) Normalize key facts from the Session (bookingId, flow, PI id if present, total amount).
  const session = event.data.object as Stripe.Checkout.Session;
  const { bookingId, flow, paymentIntentId, amountTotalCents } =
    extractSessionFacts(session);

  // 2) If we cannot tie the session to a booking, log and exit safely.
  if (bookingId == null) {
    log("async_succeeded:no_booking_id", {
      client_reference_id: session.client_reference_id,
      metadata: session.metadata,
    });
    return;
  }

  // 3) Legacy safety: we no longer support manual-capture balance authorizations.
  if (flow === "balance_authorize") {
    log("async_succeeded:balance_authorize_ignored", {
      bookingId,
      sessionId: session.id,
      amount_total: amountTotalCents ?? null,
    });
    return;
  }

  // 4) Full payment (covers legacy "deposit" and new "full_upfront"):
  //    Ensure a PI id exists; some async payloads omit it and require expansion.
  const piId =
    paymentIntentId ?? (await ensurePaymentIntentIdFromSession(session, log));

  log("async_succeeded:full_payment_promote", {
    bookingId,
    sessionId: session.id,
    piId: piId ?? null,
    amount_total: amountTotalCents ?? null,
    flow,
  });

  // 5) Idempotent promotion to CONFIRMED + attach PI.
  await promoteBookingToConfirmed({ bookingId, paymentIntentId: piId ?? null }, log);

  // 6) Notify customer (best-effort; non-fatal on error).
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
