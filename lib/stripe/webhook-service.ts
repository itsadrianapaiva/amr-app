// Centralized helpers for Stripe webhook handling.
// Keep route.ts tiny and testable by importing only these functions.

import type Stripe from "stripe";
import { db } from "@/lib/db";
import { BookingStatus } from "@prisma/client";
import { getStripe } from "@/lib/stripe";

/** Minimal logger interface for structured logs in prod/tests. */
export type LogFn = (event: string, data?: Record<string, unknown>) => void;

/** No-op logger by default to keep helpers side-effect free in tests. */
const defaultLog: LogFn = () => {};

/** Extract first integer found in a string like "booking-123" or "123" */
export function parseIdLike(val: unknown): number | null {
  if (val == null) return null;
  const m = String(val).match(/\d+/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

/** Extract PI id in a type-safe way from a Checkout Session */
export function paymentIntentIdFromSession(
  session: Stripe.Checkout.Session
): string | null {
  const pi = session.payment_intent;
  if (!pi) return null;
  return typeof pi === "string" ? pi : pi.id;
}

/** Prefer metadata.bookingId, fallback to client_reference_id */
export function bookingIdFromSession(
  session: Stripe.Checkout.Session
): number | null {
  const fromMeta = parseIdLike(session.metadata?.bookingId);
  if (fromMeta != null) return fromMeta;
  return parseIdLike(session.client_reference_id);
}

/** Pull a simple 'flow' marker (defaults to 'deposit' for back-compat) */
export function flowFromMeta(
  meta?: Stripe.Metadata | null
): "deposit" | "balance_authorize" {
  const raw = (meta?.flow ?? "").toString().trim().toLowerCase();
  return raw === "balance_authorize" ? "balance_authorize" : "deposit";
}

/** Convert Stripe minor units (cents) into a Decimal-friendly EUR string */
export function euroStringFromCents(cents?: number | null): string | null {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return null;
  return (cents / 100).toFixed(2);
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
    else
      log("pi.ensure:resolved_after_expand", {
        sessionId: session.id,
        piId: id,
      });
    return id;
  } catch (err) {
    log("pi.ensure:error", {
      sessionId: session.id,
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** Idempotent promotion: PENDING -> CONFIRMED, clear hold window, attach PI */
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
        depositPaid: true,
      },
    });
    if (!existing) {
      log("promote:not_found", { bookingId: args.bookingId });
      return; // ack anyway
    }

    // If already confirmed and paid, nothing to do
    if (existing.status === BookingStatus.CONFIRMED && existing.depositPaid) {
      log("promote:already_confirmed", { bookingId: existing.id });
      return;
    }

    await tx.booking.update({
      where: { id: args.bookingId },
      data: {
        status: BookingStatus.CONFIRMED,
        depositPaid: true,
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

/** Store/refresh manual-capture authorization (PI id + amount) */
export async function upsertBalanceAuthorization(
  args: {
    bookingId: number;
    paymentIntentId: string | null;
    amountCents?: number | null; // capturable or total; converted to EUR string
  },
  log: LogFn = defaultLog
) {
  if (!args.paymentIntentId) {
    log("auth:skip_no_pi", { bookingId: args.bookingId });
    return;
  }
  const amountStr = euroStringFromCents(args.amountCents);
  const data: any = {
    authorizedPaymentIntentId: args.paymentIntentId,
  };
  if (amountStr != null) data.authorizedAmount = amountStr;

  const res = await db.booking.updateMany({
    where: { id: args.bookingId },
    data,
  });
  log("auth:stored", {
    bookingId: args.bookingId,
    pi: args.paymentIntentId,
    amount: amountStr ?? null,
    changed: res.count,
  });
}

/** Cancel a still-pending booking on session.expired — idempotent */
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

/** Convenience: read bookingId + PI + flow from a Session in one place */
export function extractSessionFacts(session: Stripe.Checkout.Session) {
  return {
    bookingId: bookingIdFromSession(session),
    flow: flowFromMeta(session.metadata),
    paymentIntentId: paymentIntentIdFromSession(session),
    amountTotalCents:
      typeof session.amount_total === "number" ? session.amount_total : null,
  };
}

/** Convenience: read bookingId + flow from a PaymentIntent in one place */
export function extractPIFacts(pi: Stripe.PaymentIntent) {
  return {
    bookingId: parseIdLike(pi.metadata?.bookingId),
    flow: flowFromMeta(pi.metadata),
    amountCapturableCents: pi.amount_capturable,
  };
}
