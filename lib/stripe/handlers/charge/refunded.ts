// Handle Stripe `charge.refunded` events:
// - Idempotently record the event
// - Resolve Booking via payment_intent id saved on Booking.stripePaymentIntentId
// - Update Booking refund fields: refundedAmountCents, refundStatus, refundIds[], stripeChargeId

import type Stripe from "stripe";
import { db } from "@/lib/db";
import type { LogFn } from "@/lib/stripe/webhook-service";
import { RefundStatus } from "@prisma/client";

/** Try to insert an event row; return false if already processed. */
async function tryRecordEvent(
  eventId: string,
  type: string,
  bookingId?: number | null
): Promise<boolean> {
  try {
    await db.stripeEvent.create({
      data: { eventId, type, bookingId: bookingId ?? null },
    });
    return true;
  } catch (err: unknown) {
    // Unique constraint violation means we processed this event already
    // Prisma codes: P2002 for unique violation
    if (typeof err === "object" && err && "code" in err && (err as any).code === "P2002") {
      return false;
    }
    throw err;
  }
}

/** Extract a PaymentIntent id from a Charge in a type-safe way. */
function paymentIntentIdFromCharge(charge: Stripe.Charge): string | null {
  const pi = charge.payment_intent;
  if (!pi) return null;
  return typeof pi === "string" ? pi : pi.id;
}

/** Merge new refund ids into a unique, stable array. */
function mergeRefundIds(existing: string[], incoming: string[]): string[] {
  const set = new Set<string>(existing);
  for (const id of incoming) if (id) set.add(id);
  return Array.from(set);
}

/** Main entry called by the webhook router. */
export async function onChargeRefunded(event: Stripe.Event, log: LogFn): Promise<void> {
  // 1) Parse event payload
  const charge = event.data.object as Stripe.Charge;

  const piId = paymentIntentIdFromCharge(charge);
  if (!piId) {
    log("refund:skip_no_pi", { chargeId: charge.id });
    // Record idempotency anyway to avoid retries doing work later
    await tryRecordEvent(event.id, event.type, null);
    return;
  }

  // 2) Find the booking by saved PaymentIntent id
  const booking = await db.booking.findUnique({
    where: { stripePaymentIntentId: piId },
    select: {
      id: true,
      refundedAmountCents: true,
      refundStatus: true,
      refundIds: true,
      stripeChargeId: true,
      totalCost: true, // Decimal
    },
  });

  if (!booking) {
    // Still record the event to remain idempotent
    const first = await tryRecordEvent(event.id, event.type, null);
    log("refund:booking_not_found", { piId, chargeId: charge.id, recorded: first });
    return;
  }

  // 3) Idempotency: bail out if we already processed this event.id
  const freshlyRecorded = await tryRecordEvent(event.id, event.type, booking.id);
  if (!freshlyRecorded) {
    log("refund:duplicate_event", { eventId: event.id, bookingId: booking.id });
    return;
  }

  // 4) Compute refund aggregates from the Charge snapshot
  const totalRefunded = typeof charge.amount_refunded === "number" ? charge.amount_refunded : 0; // cents
  const chargeAmount = typeof charge.amount === "number" ? charge.amount : null;

  // Stripe may include refunds array only when expanded; best-effort capture
  const newRefundIds =
    Array.isArray((charge.refunds as any)?.data)
      ? ((charge.refunds as Stripe.ApiList<Stripe.Refund>).data.map(r => r.id).filter(Boolean))
      : [];

  // Determine PARTIAL vs FULL with safe fallback
  let status: RefundStatus = RefundStatus.PARTIAL;
  if (chargeAmount != null && totalRefunded >= chargeAmount) {
    status = RefundStatus.FULL;
  } else if (totalRefunded === 0) {
    status = RefundStatus.NONE; // defensive, should not occur on charge.refunded
  }

  // 5) Persist updates atomically
  await db.$transaction(async (tx) => {
    // Re-read inside tx to avoid lost updates
    const cur = await tx.booking.findUnique({
      where: { id: booking.id },
      select: { refundIds: true, stripeChargeId: true },
    });
    const mergedIds = mergeRefundIds(cur?.refundIds ?? [], newRefundIds);

    await tx.booking.update({
      where: { id: booking.id },
      data: {
        refundedAmountCents: totalRefunded,
        refundStatus: status,
        refundIds: mergedIds,
        // Save the charge id if we do not have it yet
        stripeChargeId: cur?.stripeChargeId ?? charge.id,
      },
    });
  });

  log("refund:booking_updated", {
    bookingId: booking.id,
    refundedAmountCents: totalRefunded,
    refundStatus: status,
    appendedRefundIds: newRefundIds.length,
  });
}
