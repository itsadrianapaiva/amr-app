// Full-upfront pivot:
// - Ignore legacy manual-capture auth sessions.
// - Promote the booking to CONFIRMED on async success (MB WAY / SEPA), attach PI, create async jobs.

import type Stripe from "stripe";
import {
  extractSessionFacts,
  ensurePaymentIntentIdFromSession,
  promoteBookingToConfirmed,
  type LogFn,
} from "@/lib/stripe/webhook-service";

import { createBookingJobs } from "@/lib/jobs/create-booking-jobs";

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

  // Extract discount metadata from session
  const { discountMetadata, amountTotalCents: totalCents } =
    extractSessionFacts(session);

  // 5) Idempotent promotion to CONFIRMED + attach PI + persist totals.
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

  // 5.1) Create async jobs for invoice issuance and notifications (A3.5)
  //      Jobs are processed by cron every 1 minute + immediate kick
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
