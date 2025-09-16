// Minimal router + in-file registry. All event logic lives in handlers/* files.

import type Stripe from "stripe";
import type { LogFn } from "@/lib/stripe/webhook-service";

//  per-event handlers
import { onCheckoutSessionCompleted } from "@/lib/stripe/handlers/checkout/completed";
import { onCheckoutSessionAsyncPaymentSucceeded } from "@/lib/stripe/handlers/checkout/async-payment-succeeded";
import { onCheckoutSessionAsyncPaymentFailed } from "@/lib/stripe/handlers/checkout/async-payment-failed"; // 🆕 new import
import { onCheckoutSessionExpired } from "@/lib/stripe/handlers/checkout/expired";

import { onPaymentIntentSucceeded } from "@/lib/stripe/handlers/payment_intent/succeeded";
import { onPaymentIntentFailed } from "@/lib/stripe/handlers/payment_intent/failed";

import { onChargeRefunded } from "@/lib/stripe/handlers/charge/refunded";
import { onChargeRefundUpdated } from "@/lib/stripe/handlers/charge/refund-updated";

import { onChargeDisputeCreated } from "@/lib/stripe/handlers/charge/dispute-created";

// Uniform handler signature
type EventHandler = (event: Stripe.Event, log: LogFn) => Promise<void>;

// Flat registry: event type → handler
const HANDLERS: Record<string, EventHandler> = {
  // checkout.* (Checkout is the source of truth for session → booking mapping)
  "checkout.session.completed": onCheckoutSessionCompleted,
  // Async confirmations (MB WAY / SEPA)
  "checkout.session.async_payment_succeeded":
    onCheckoutSessionAsyncPaymentSucceeded,
  "checkout.session.async_payment_failed": onCheckoutSessionAsyncPaymentFailed, // 🆕 new entry
  "checkout.session.expired": onCheckoutSessionExpired,

  // payment_intent.* (immediate outcomes / failures)
  "payment_intent.succeeded": onPaymentIntentSucceeded,
  "payment_intent.payment_failed": onPaymentIntentFailed,

  // charge.*
  "charge.refunded": onChargeRefunded,
  "charge.refund.updated": onChargeRefundUpdated,
  // charge.* disputes
  "charge.dispute.created": onChargeDisputeCreated,
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

  // explicit dispatch logs to prove the handler is invoked
  log("dispatch:start", { type: event.type });

  await handler(event, log);

  log("dispatch:done", { type: event.type });
}
