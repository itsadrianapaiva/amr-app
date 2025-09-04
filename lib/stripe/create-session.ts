/**
 * Small wrapper around Stripe Checkout session creation with guard rails:
 * - Verifies client_reference_id and metadata.bookingId are present.
 * - Mirrors metadata to payment_intent_data.metadata for easy reconciliation.
 * - Supports an idempotency key to avoid duplicate sessions.
 */

import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";

/** Narrow alias to avoid importing the whole Stripe namespace at call sites. */
export type CheckoutParams = Stripe.Checkout.SessionCreateParams;

type CreateOpts = {
  /** Provide a stable idempotency key like `booking-<id>-deposit`. */
  idempotencyKey?: string;
  /** Optional logger for structured logs in tests or prod. */
  log?: (event: string, data?: Record<string, unknown>) => void;
};

/** Ensure bookingId lives in both session and payment_intent metadata. */
function withBookingMetadata(params: CheckoutParams): CheckoutParams {
  const sessionMeta = params.metadata ?? {};
  // Try to read bookingId from any known slot.
  const bookingId =
    (sessionMeta as any).bookingId ??
    ((params.client_reference_id ?? "").replace(/^booking-/, "") || undefined);

  // If we still do not have it, leave params as is. Guard will catch this later.
  if (!bookingId) return params;

  const piMeta = {
    ...(params.payment_intent_data?.metadata ?? {}),
    bookingId,
  };

  return {
    ...params,
    metadata: { ...sessionMeta, bookingId },
    payment_intent_data: {
      ...params.payment_intent_data,
      metadata: piMeta,
    },
  };
}

/**
 * createCheckoutSessionWithGuards
 * Validates minimal fields, mirrors metadata to the PaymentIntent, and creates the session.
 */
export async function createCheckoutSessionWithGuards(
  rawParams: CheckoutParams,
  opts?: CreateOpts
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();

  // Mirror bookingId metadata to PI for later lookups in webhooks or dashboards.
  const params = withBookingMetadata(rawParams);

  // Guard rails: require client_reference_id and metadata.bookingId.
  const hasClientRef = !!params.client_reference_id;
  const hasBookingId =
    !!params.metadata &&
    typeof (params.metadata as any).bookingId !== "undefined";

  if (!hasClientRef || !hasBookingId) {
    const detail = {
      hasClientRef,
      hasBookingId,
      metadata: params.metadata,
      mode: params.mode,
      success_url: params.success_url,
      cancel_url: params.cancel_url,
    };
    opts?.log?.("stripe.checkout.guard_failed", detail);
    throw new Error(
      "Stripe Checkout params missing client_reference_id or metadata.bookingId"
    );
  }

  // Optional idempotency key to protect against double clicks.
  const idempotencyKey = opts?.idempotencyKey;

  opts?.log?.("stripe.checkout.create_attempt", {
    client_reference_id: params.client_reference_id,
    bookingId: (params.metadata as any).bookingId,
    mode: params.mode,
  });

  const session = await stripe.checkout.sessions.create(params, {
    idempotencyKey,
  });

  opts?.log?.("stripe.checkout.create_success", {
    id: session.id,
    url_present: !!session.url,
    payment_intent: session.payment_intent ? "present" : "absent",
  });

  return session;
}

/** Handy constant for listeners. */
export const CHECKOUT_COMPLETED_EVENT = "checkout.session.completed";
