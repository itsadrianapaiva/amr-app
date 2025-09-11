/**
 * Small wrapper around Stripe Checkout session creation with guard rails:
 * - Verifies client_reference_id and metadata.bookingId are present.
 * - Mirrors metadata to payment_intent_data.metadata for easy reconciliation.
 * - Supports an idempotency key to avoid duplicate sessions.
 * - NEW: Strips `customer_update` when no `customer` is provided (Stripe 400 guard).
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

/** Metadata shape helper (Stripe requires string→string). */
type Metadata = Stripe.MetadataParam;

/** Try to extract a bookingId from params (metadata first, else client_reference_id "booking-<id>"). */
function extractBookingIdFromParams(
  params: CheckoutParams
): string | undefined {
  const metaId =
    (params.metadata && typeof params.metadata["bookingId"] === "string"
      ? params.metadata["bookingId"]
      : undefined) ?? undefined;

  if (metaId) return metaId;

  const clientRef = params.client_reference_id ?? "";
  if (clientRef.startsWith("booking-")) {
    const id = clientRef.replace(/^booking-/, "");
    return id || undefined;
  }
  return undefined;
}

/** Pull only `startDate` / `endDate` (if present & string) from a metadata bag. */
function pickDateMetadata(meta?: Metadata): Metadata {
  const out: Record<string, string> = {};
  const s = meta?.["startDate"];
  const e = meta?.["endDate"];
  if (typeof s === "string") out.startDate = s;
  if (typeof e === "string") out.endDate = e;
  return out;
}

/** Ensure bookingId (and date keys when present) live in both session and payment_intent metadata. */
function withBookingMetadata(params: CheckoutParams): CheckoutParams {
  const bookingId = extractBookingIdFromParams(params);
  if (!bookingId) return params;

  // Carry dates only if the builder supplied them on the Session metadata.
  const dateMeta = pickDateMetadata(params.metadata);

  const sessionMeta: Metadata = {
    ...(params.metadata ?? {}),
    bookingId,
    ...dateMeta,
  };

  const piMeta: Metadata = {
    ...(params.payment_intent_data?.metadata ?? {}),
    bookingId,
    ...dateMeta, // <— mirror start/end dates into PI metadata too
  };

  return {
    ...params,
    metadata: sessionMeta,
    payment_intent_data: {
      ...params.payment_intent_data,
      metadata: piMeta,
    },
  };
}

/**
 * Stripe now enforces that `customer_update` can only be used when a `customer` is attached.
 * If callers don't attach a Customer, silently drop `customer_update` to avoid 400s.
 * (We keep this behavior here so all call sites get the guard automatically.)
 */
function stripCustomerUpdateIfNoCustomer(
  params: CheckoutParams,
  log?: CreateOpts["log"]
): CheckoutParams {
  if (params.customer) return params; // valid usage; leave as-is
  if (params.customer_update) {
    // Destructure to omit `customer_update` while preserving the rest of the payload.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { customer_update, ...rest } = params;
    log?.("stripe.checkout.strip_customer_update", {
      reason: "no_customer",
    });
    return rest;
  }
  return params;
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
  const paramsWithMeta = withBookingMetadata(rawParams);

  // Guard rails: require client_reference_id and a resolvable bookingId.
  const hasClientRef = !!paramsWithMeta.client_reference_id;
  const bookingId = extractBookingIdFromParams(paramsWithMeta);
  const hasBookingId = !!bookingId;

  if (!hasClientRef || !hasBookingId) {
    const detail: Record<string, unknown> = {
      hasClientRef,
      hasBookingId,
      metadata: paramsWithMeta.metadata ?? {},
      mode: paramsWithMeta.mode,
      success_url: paramsWithMeta.success_url,
      cancel_url: paramsWithMeta.cancel_url,
    };
    opts?.log?.("stripe.checkout.guard_failed", detail);
    throw new Error(
      "Stripe Checkout params missing client_reference_id or metadata.bookingId"
    );
  }

  // Drop `customer_update` if `customer` is not present (prevents 400).
  const safeParams = stripCustomerUpdateIfNoCustomer(
    paramsWithMeta,
    opts?.log
  );

  // Optional idempotency key to protect against double clicks.
  const idempotencyKey = opts?.idempotencyKey;

  opts?.log?.("stripe.checkout.create_attempt", {
    client_reference_id: safeParams.client_reference_id,
    bookingId,
    mode: safeParams.mode,
  });

  const session = await stripe.checkout.sessions.create(safeParams, {
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
