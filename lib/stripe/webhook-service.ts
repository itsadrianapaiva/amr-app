// Centralized helpers for Stripe webhook handling.
// Full-upfront pivot: no manual-capture auth storage; keep helpers lean.

import type Stripe from "stripe";
import { db } from "@/lib/db";
import { BookingStatus } from "@prisma/client";
import { getStripe } from "@/lib/stripe";

/** Minimal logger interface for structured logs in prod/tests. */
export type LogFn = (event: string, data?: Record<string, unknown>) => void;

/** No-op logger by default to keep helpers side-effect free in tests. */
const defaultLog: LogFn = () => {};

/** Extract first integer found in a string like "booking-123" or "123". */
export function parseIdLike(val: unknown): number | null {
  if (val == null) return null;
  const m = String(val).match(/\d+/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

/** Extract PI id in a type-safe way from a Checkout Session. */
export function paymentIntentIdFromSession(
  session: Stripe.Checkout.Session
): string | null {
  const pi = session.payment_intent;
  if (!pi) return null;
  return typeof pi === "string" ? pi : pi.id;
}

/** Prefer metadata.bookingId, fallback to client_reference_id. */
export function bookingIdFromSession(
  session: Stripe.Checkout.Session
): number | null {
  const fromMeta = parseIdLike(session.metadata?.bookingId);
  if (fromMeta != null) return fromMeta;
  return parseIdLike(session.client_reference_id);
}

/**
 * Pull a simple 'flow' marker.
 * - "balance_authorize": legacy manual-capture auth (ignored now).
 * - "full_upfront": new flow (treated as full payment).
 * - default: treat as historical "deposit" → same as full payment for promotion.
 */
export function flowFromMeta(
  meta?: Stripe.Metadata | null
): "full_upfront" | "deposit" | "balance_authorize" {
  const raw = (meta?.flow ?? "").toString().trim().toLowerCase();
  if (raw === "balance_authorize") return "balance_authorize";
  if (raw === "full_upfront") return "full_upfront";
  return "deposit";
}

/**
 * Sometimes `checkout.session.completed` doesn’t include `payment_intent`
 * on the event payload (rare but observed). As a fallback, retrieve the
 * Session with `expand: ['payment_intent']` and pull the id.
 */
export async function ensurePaymentIntentIdFromSession(
  session: Stripe.Checkout.Session,
  log: LogFn = defaultLog
): Promise<string | null> {
  const direct = paymentIntentIdFromSession(session);
  if (direct) return direct;

  try {
    const stripe = getStripe();
    const fresh = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ["payment_intent"],
    });
    const pi = fresh.payment_intent;
    const id = typeof pi === "string" ? pi : (pi?.id ?? null);
    if (!id) log("pi.ensure:missing_after_expand", { sessionId: session.id });
    else log("pi.ensure:resolved_after_expand", { sessionId: session.id, piId: id });
    return id;
  } catch (err) {
    log("pi.ensure:error", {
      sessionId: session.id,
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** Idempotent promotion: PENDING -> CONFIRMED, clear hold window, attach PI. */
export async function promoteBookingToConfirmed(
  args: { bookingId: number; paymentIntentId: string | null },
  log: LogFn = defaultLog
) {
  await db.$transaction(async (tx) => {
    const existing = await tx.booking.findUnique({
      where: { id: args.bookingId },
      select: {
        id: true,
        status: true,
        stripePaymentIntentId: true,
        depositPaid: true, // TODO: rename to `paid` in a later migration.
      },
    });
    if (!existing) {
      log("promote:not_found", { bookingId: args.bookingId });
      return; // ack anyway
    }

    // If already confirmed and paid, nothing to do.
    if (existing.status === BookingStatus.CONFIRMED && existing.depositPaid) {
      log("promote:already_confirmed", { bookingId: existing.id });
      return;
    }

    await tx.booking.update({
      where: { id: args.bookingId },
      data: {
        status: BookingStatus.CONFIRMED,
        depositPaid: true, // interim: means "fully paid" after the pivot.
        holdExpiresAt: null,
        stripePaymentIntentId:
          args.paymentIntentId ?? existing.stripePaymentIntentId ?? null,
      },
    });

    log("promote:updated", {
      bookingId: args.bookingId,
      attachedPI: args.paymentIntentId ?? null,
    });
  });
}

/** Cancel a still-pending booking on session.expired — idempotent. */
export async function cancelPendingBooking(
  bookingId: number,
  log: LogFn = defaultLog
) {
  const res = await db.booking.updateMany({
    where: { id: bookingId, status: BookingStatus.PENDING },
    data: { status: BookingStatus.CANCELLED, holdExpiresAt: null },
  });
  log("expired:cancelled_pending", { bookingId, changed: res.count });
}

/** Convenience: read bookingId + PI + flow from a Session in one place. */
export function extractSessionFacts(session: Stripe.Checkout.Session) {
  return {
    bookingId: bookingIdFromSession(session),
    flow: flowFromMeta(session.metadata),
    paymentIntentId: paymentIntentIdFromSession(session),
    amountTotalCents:
      typeof session.amount_total === "number" ? session.amount_total : null,
  };
}

/** Convenience: read bookingId + flow from a PaymentIntent in one place. */
export function extractPIFacts(pi: Stripe.PaymentIntent) {
  return {
    bookingId: parseIdLike(pi.metadata?.bookingId),
    flow: flowFromMeta(pi.metadata),
  };
}
