// Sync dispute-closed events into Booking.dispute* fields, idempotently.

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

/** Map Stripe dispute.status to our DisputeStatus. */
function mapDisputeStatus(stripeStatus: string | null | undefined): DisputeStatus {
  const s = (stripeStatus ?? "").toLowerCase();
  // Stripe statuses of interest here:
  // won, lost, warning_closed, charge_refunded
  if (s === "won" || s === "warning_closed") return DisputeStatus.WON;
  if (s === "lost" || s === "charge_refunded") return DisputeStatus.LOST;
  // Defensive default
  return DisputeStatus.LOST;
}

/** Resolve PI id by fetching the charge on the dispute. */
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

export async function onChargeDisputeClosed(event: Stripe.Event, log: LogFn): Promise<void> {
  const dispute = event.data.object as Stripe.Dispute;

  const { piId, chargeId } = await resolvePiIdFromDispute(dispute);

  // Record even if we cannot resolve a booking, to stay idempotent on retries.
  if (!piId) {
    const fresh = await record(event.id, event.type, null);
    log("dispute.closed:no_pi", { disputeId: dispute.id, recorded: fresh });
    return;
  }

  const booking = await db.booking.findUnique({
    where: { stripePaymentIntentId: piId },
    select: {
      id: true,
      disputeId: true,
      disputeStatus: true,
      disputeClosedAt: true,
      disputeReason: true,
      stripeChargeId: true,
    },
  });

  const fresh = await record(event.id, event.type, booking?.id ?? null);
  if (!fresh) {
    log("dispute.closed:duplicate_event", { eventId: event.id, disputeId: dispute.id });
    return;
  }

  if (!booking) {
    log("dispute.closed:booking_not_found", { disputeId: dispute.id, piId });
    return;
  }

  // Compute final status and closed timestamp.
  const finalStatus = mapDisputeStatus(dispute.status);
  // Use the event.created as the close marker to avoid relying on a non-guaranteed field.
  const closedAt = new Date((event.created ?? Math.floor(Date.now() / 1000)) * 1000);

  await db.booking.update({
    where: { id: booking.id },
    data: {
      disputeStatus: finalStatus,
      disputeId: dispute.id, // keep last known id
      disputeReason: booking.disputeReason ?? dispute.reason ?? null,
      disputeClosedAt: closedAt,
      stripeChargeId: booking.stripeChargeId ?? chargeId ?? booking.stripeChargeId,
    },
  });

  log("dispute.closed:booking_updated", {
    bookingId: booking.id,
    disputeId: dispute.id,
    finalStatus,
    closedAt: closedAt.toISOString(),
  });
}
