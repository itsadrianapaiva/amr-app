// Full-upfront pivot: promote the booking on completion (card immediate),
// create async jobs, and ignore legacy manual-capture auth sessions gracefully.

import type Stripe from "stripe";
import {
  extractSessionFacts,
  ensurePaymentIntentIdFromSession,
  promoteBookingToConfirmed,
  type LogFn,
} from "@/lib/stripe/webhook-service";

import { createBookingJobs } from "@/lib/jobs/create-booking-jobs";

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

  // ── NEW: Only promote here if the payment is definitively paid.
  // For async methods (MB WAY / SEPA), completed often arrives with unpaid/processing.
  const paymentStatus = session.payment_status ?? null;
  const piStatus =
    typeof session.payment_intent === "object"
      ? session.payment_intent?.status ?? null
      : null;

  const isPaid =
    paymentStatus === "paid" || piStatus === "succeeded";

  if (!isPaid) {
    // Defer to checkout.session.async_payment_succeeded or PI.succeeded to promote.
    log("completed:awaiting_async", {
      bookingId,
      sessionId: session.id,
      payment_status: paymentStatus,
      pi_status: piStatus,
    });
    return;
  }
  // ── End NEW guard

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

  // Extract discount metadata from session
  const { discountMetadata, amountTotalCents: totalCents } =
    extractSessionFacts(session);

  // Idempotent promotion to CONFIRMED + attach PI + persist totals.
  await promoteBookingToConfirmed(
    {
      bookingId,
      paymentIntentId: piId ?? null,
      totalCostEuros: totalCents != null ? totalCents / 100 : null,
      discountPercent: discountMetadata?.discountPercent ?? null,
      originalSubtotalExVatCents: discountMetadata?.originalCents ?? null,
      discountedSubtotalExVatCents: discountMetadata?.discountedCents ?? null,
    },
    log
  );

  // Create async jobs for invoice issuance and notifications (A3.5)
  // Jobs are processed by cron every 1 minute + immediate kick
  if (piId) {
    log("jobs:creating", { bookingId });
    await createBookingJobs(
      bookingId,
      [
        {
          type: "issue_invoice",
          payload: { stripePaymentIntentId: piId },
        },
        {
          type: "send_customer_confirmation",
          payload: {},
        },
        {
          type: "send_internal_confirmation",
          payload: {},
        },
      ],
      log
    );
    log("jobs:created", { bookingId });
  } else {
    log("jobs:skipped_no_pi", {
      bookingId,
      reason: "missing_payment_intent_id",
    });
  }
}
