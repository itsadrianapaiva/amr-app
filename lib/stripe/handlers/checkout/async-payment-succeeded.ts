// File: lib/stripe/handlers/checkout/async-payment-succeeded.ts
// Single-responsibility handler for `checkout.session.async_payment_succeeded`.
// Covers async confirmations (e.g., bank transfers, wallets). We:
// - For balance_authorize: ensure PI id, then persist the authorization (PI + amount).
// - For deposit: promote booking to CONFIRMED and notify the customer.

import type Stripe from "stripe";
import { notifyBookingConfirmed } from "@/lib/notifications/notify-booking-confirmed";
import {
  extractSessionFacts,
  ensurePaymentIntentIdFromSession,
  upsertBalanceAuthorization,
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
  if (!bookingId) {
    log("async_succeeded:no_booking_id", {
      client_reference_id: session.client_reference_id,
      metadata: session.metadata,
    });
    return;
  }

  // 3) Authorization flow (manual capture): guarantee PI id and store the auth (PI + amount).
  if (flow === "balance_authorize") {
    // Some async-success payloads omit payment_intent; expand as a fallback.
    const piId =
      paymentIntentId ?? (await ensurePaymentIntentIdFromSession(session, log));

    log("async_succeeded:balance_authorize", {
      bookingId,
      sessionId: session.id,
      piId: piId ?? null,
      amount_total: amountTotalCents ?? null,
    });

    await upsertBalanceAuthorization(
      { bookingId, paymentIntentId: piId, amountCents: amountTotalCents },
      log
    );
    return;
  }

  // 4) Deposit flow (capture): promote to CONFIRMED and notify.
  log("async_succeeded:deposit_promote", {
    bookingId,
    sessionId: session.id,
    piId: paymentIntentId ?? null,
  });

  await promoteBookingToConfirmed({ bookingId, paymentIntentId }, log);
  await notifyBookingConfirmed(bookingId, "customer");
}
