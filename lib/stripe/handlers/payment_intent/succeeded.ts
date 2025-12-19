// - Promote the booking (idempotent), attach PI, create async jobs.
// - Ignore legacy manual-capture auth flow safely.

import type Stripe from "stripe";
import {
  extractPIFacts,
  promoteBookingToConfirmed,
  type LogFn,
} from "@/lib/stripe/webhook-service";

import { createBookingJobs } from "@/lib/jobs/create-booking-jobs";

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

  // 4.1) Create async jobs for invoice issuance and notifications (A3.5)
  //      Jobs are processed by cron every 1 minute + immediate kick
  log("jobs:creating", { bookingId });
  await createBookingJobs(
    bookingId,
    [
      {
        type: "issue_invoice",
        payload: { stripePaymentIntentId: pi.id },
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
}
