// Minimal router + in-file registry. All event logic lives in handlers/* files.

import type Stripe from "stripe";
import type { LogFn } from "@/lib/stripe/webhook-service";

//  per-event handlers
import { onCheckoutSessionCompleted } from "@/lib/stripe/handlers/checkout/completed";
import { onCheckoutSessionAsyncPaymentSucceeded } from "@/lib/stripe/handlers/checkout/async-payment-succeeded";
import { onCheckoutSessionExpired } from "@/lib/stripe/handlers/checkout/expired";
import { onPaymentIntentSucceeded } from "@/lib/stripe/handlers/payment_intent/succeeded";
import { onPaymentIntentFailed } from "@/lib/stripe/handlers/payment_intent/failed";

// Uniform handler signature
type EventHandler = (event: Stripe.Event, log: LogFn) => Promise<void>;

// Flat registry: event type → handler
const HANDLERS: Record<string, EventHandler> = {
  // checkout.* (Checkout is the source of truth for session → booking mapping)
  "checkout.session.completed": onCheckoutSessionCompleted,
  // IMPORTANT for async methods (MB WAY, SEPA Direct Debit): this fires when the
  // asynchronous confirmation finally succeeds. Use it to promote the booking.
  "checkout.session.async_payment_succeeded":
    onCheckoutSessionAsyncPaymentSucceeded,
  "checkout.session.expired": onCheckoutSessionExpired,

  // payment_intent.* (card immediate outcomes / failures)
  "payment_intent.succeeded": onPaymentIntentSucceeded,
  "payment_intent.payment_failed": onPaymentIntentFailed,
};

// Entry point used by app/api/stripe/webhook/route.ts
export async function handleStripeEvent(
  event: Stripe.Event,
  log: LogFn
): Promise<void> {
  const handler = HANDLERS[event.type];
  if (!handler) {
    log("ignored", { type: event.type });
    return;
  }
  await handler(event, log);
}
