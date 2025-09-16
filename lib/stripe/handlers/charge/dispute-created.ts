// Sync dispute-open events into Booking.dispute* fields, idempotently.

import type Stripe from "stripe";
import { db } from "@/lib/db";
import type { LogFn } from "@/lib/stripe/webhook-service";
import { DisputeStatus } from "@prisma/client";

/** Idempotent insert for StripeEvent log. Returns true if fresh. */
async function record(eventId: string, type: string, bookingId?: number | null) {
  try {
    await db.stripeEvent.create({ data: { eventId, type, bookingId: bookingId ?? null } });
    return true;
  } catch (e: any) {
    if (e && e.code === "P2002") return false;
    throw e;
  }
}

/** Best-effort: get PaymentIntent id from a Dispute's charge by fetching the Charge. */
async function resolvePiIdFromDispute(dispute: Stripe.Dispute): Promise<{
  piId: string | null;
  chargeId: string | null;
}> {
  const { getStripe } = await import("@/lib/stripe");
  const stripe = getStripe();

  const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id ?? null;
  if (!chargeId) return { piId: null, chargeId: null };

  try {
    const charge = await stripe.charges.retrieve(chargeId);
    const pi = charge.payment_intent;
    const piId = typeof pi === "string" ? pi : pi?.id ?? null;
    return { piId, chargeId: charge.id };
  } catch {
    return { piId: null, chargeId };
  }
}

export async function onChargeDisputeCreated(event: Stripe.Event, log: LogFn): Promise<void> {
  const dispute = event.data.object as Stripe.Dispute;

  const { piId, chargeId } = await resolvePiIdFromDispute(dispute);

  // Record even if we cannot resolve a booking, to stay idempotent on retries.
  if (!piId) {
    const fresh = await record(event.id, event.type, null);
    log("dispute.created:no_pi", { disputeId: dispute.id, recorded: fresh });
    return;
  }

  const booking = await db.booking.findUnique({
    where: { stripePaymentIntentId: piId },
    select: {
      id: true,
      disputeId: true,
      disputeStatus: true,
      disputeReason: true,
      stripeChargeId: true,
    },
  });

  const fresh = await record(event.id, event.type, booking?.id ?? null);
  if (!fresh) {
    log("dispute.created:duplicate_event", { eventId: event.id, disputeId: dispute.id });
    return;
  }

  if (!booking) {
    log("dispute.created:booking_not_found", { disputeId: dispute.id, piId });
    return;
  }

  // Update only dispute-related fields. Do not alter Booking.status.
  await db.booking.update({
    where: { id: booking.id },
    data: {
      disputeId: dispute.id,
      disputeStatus: DisputeStatus.OPEN,
      disputeReason: dispute.reason ?? booking.disputeReason ?? null,
      stripeChargeId: booking.stripeChargeId ?? chargeId ?? booking.stripeChargeId,
    },
  });

  log("dispute.created:booking_flagged", {
    bookingId: booking.id,
    disputeId: dispute.id,
    reason: dispute.reason ?? null,
  });
}
