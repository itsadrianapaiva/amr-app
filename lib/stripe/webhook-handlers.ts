// File: lib/stripe/webhook-handlers.ts
// Flow-aware Stripe webhook handlers. Keeps app/api/stripe/webhook/route.ts tiny.

import type Stripe from "stripe";
import { notifyBookingConfirmed } from "@/lib/notifications/notify-booking-confirmed";
import {
  extractSessionFacts,
  extractPIFacts,
  promoteBookingToConfirmed,
  upsertBalanceAuthorization,
  cancelPendingBooking,
  ensurePaymentIntentIdFromSession, // ⬅️ NEW: fallback to expand session for PI id
  type LogFn,
} from "@/lib/stripe/webhook-service";

/**
 * handleStripeEvent
 * Single entrypoint for all supported Stripe events.
 * `route.ts` should do signature verification, then call this.
 */
export async function handleStripeEvent(
  event: Stripe.Event,
  log: LogFn
): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const { bookingId, flow, paymentIntentId, amountTotalCents } =
        extractSessionFacts(session);

      if (bookingId == null) {
        log("completed:no_booking_id", {
          client_reference_id: session.client_reference_id,
          metadata: session.metadata,
        });
        return;
      }

      if (flow === "balance_authorize") {
        // 🔒 Manual capture: guarantee PI id even if not on payload
        const piId =
          paymentIntentId ??
          (await ensurePaymentIntentIdFromSession(session, log)); // expand ['payment_intent'] if needed

        log("completed:balance_authorize", {
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

      // Deposit flow: confirm booking + notify customer
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
      return;
    }

    case "payment_intent.amount_capturable_updated": {
      // Authoritative signal for manual-capture funds readiness
      const pi = event.data.object as Stripe.PaymentIntent;
      const { bookingId, flow, amountCapturableCents } = extractPIFacts(pi);

      if (flow !== "balance_authorize") {
        log("pi.capturable:ignored_flow", { flow });
        return;
      }
      if (!bookingId) {
        log("pi.capturable:no_booking_id", { metadata: pi.metadata });
        return;
      }

      log("pi.capturable:store_auth", {
        bookingId,
        piId: pi.id,
        amount_capturable: amountCapturableCents,
      });

      await upsertBalanceAuthorization(
        {
          bookingId,
          paymentIntentId: pi.id,
          amountCents: amountCapturableCents,
        },
        log
      );
      return;
    }

    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const { bookingId, flow } = extractPIFacts(pi);

      if (flow === "balance_authorize") {
        // Balance capture completed later by Ops; nothing to promote here.
        log("pi.succeeded:balance_capture", { piId: pi.id });
        return;
      }

      if (!bookingId) {
        log("pi.succeeded:no_booking_id", { metadata: pi.metadata });
        return;
      }

      log("pi.succeeded:deposit_promote", { bookingId, piId: pi.id });
      await promoteBookingToConfirmed(
        { bookingId, paymentIntentId: pi.id },
        log
      );

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
      return;
    }

    case "checkout.session.async_payment_succeeded": {
      // Async methods (wallets/bank transfers) that confirm after the session
      const session = event.data.object as Stripe.Checkout.Session;
      const { bookingId, flow, paymentIntentId, amountTotalCents } =
        extractSessionFacts(session);

      if (!bookingId) {
        log("async_succeeded:no_booking_id", {
          client_reference_id: session.client_reference_id,
          metadata: session.metadata,
        });
        return;
      }

      if (flow === "balance_authorize") {
        // 🔒 Manual capture (async): guarantee PI id before storing
        const piId =
          paymentIntentId ??
          (await ensurePaymentIntentIdFromSession(session, log));

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

      log("async_succeeded:deposit_promote", {
        bookingId,
        sessionId: session.id,
        piId: paymentIntentId ?? null,
      });
      await promoteBookingToConfirmed({ bookingId, paymentIntentId }, log);
      await notifyBookingConfirmed(bookingId, "customer");
      return;
    }

    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      const { bookingId } = extractSessionFacts(session);
      if (bookingId == null) {
        log("expired:no_booking_id", {
          client_reference_id: session.client_reference_id,
          metadata: session.metadata,
        });
        return;
      }
      await cancelPendingBooking(bookingId, log);
      return;
    }

    default:
      log("ignored", { type: event.type });
      return;
  }
}
