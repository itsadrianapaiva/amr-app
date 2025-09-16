import type Stripe from "stripe";
import { db } from "@/lib/db";
import type { LogFn } from "@/lib/stripe/webhook-service";
import { RefundStatus } from "@prisma/client";

/** Idempotent insert of StripeEvent. Returns true if fresh, false if duplicate. */
async function record(eventId: string, type: string, bookingId?: number | null) {
  try {
    await db.stripeEvent.create({ data: { eventId, type, bookingId: bookingId ?? null } });
    return true;
  } catch (e: any) {
    if (e && e.code === "P2002") return false;
    throw e;
  }
}

function piIdFromRefund(refund: Stripe.Refund): string | null {
  const ch = refund.charge;
  // Refund may include charge id only. We need the PI id, which sits on the Charge.
  // For MVP we accept that this handler may be a no-op unless charge is expanded
  // or you add a fetch. We will add a fetch path for robustness.
  return null;
}

/** Fallback: fetch the Charge to learn its PaymentIntent id. */
async function fetchPiIdFromRefund(refund: Stripe.Refund): Promise<string | null> {
  try {
    const stripe = (await import("@/lib/stripe")).getStripe();
    const chargeId = typeof refund.charge === "string" ? refund.charge : refund.charge?.id;
    if (!chargeId) return null;
    const charge = await stripe.charges.retrieve(chargeId);
    const pi = charge.payment_intent;
    return typeof pi === "string" ? pi : pi?.id ?? null;
  } catch {
    return null;
  }
}

export async function onChargeRefundUpdated(event: Stripe.Event, log: LogFn): Promise<void> {
  const refund = event.data.object as Stripe.Refund;

  // Resolve PI id reliably
  let piId = piIdFromRefund(refund);
  if (!piId) {
    piId = await fetchPiIdFromRefund(refund);
  }
  if (!piId) {
    const first = await record(event.id, event.type, null);
    log("refund.updated:no_pi", { refundId: refund.id, recorded: first });
    return;
  }

  const booking = await db.booking.findUnique({
    where: { stripePaymentIntentId: piId },
    select: {
      id: true,
      refundIds: true,
      refundedAmountCents: true,
      refundStatus: true,
      stripeChargeId: true,
    },
  });

  const fresh = await record(event.id, event.type, booking?.id ?? null);
  if (!fresh) {
    log("refund.updated:duplicate_event", { eventId: event.id, bookingId: booking?.id ?? null });
    return;
  }

  if (!booking) {
    log("refund.updated:booking_not_found", { piId });
    return;
  }

  // We need the current Charge to know total refunded vs charge amount
  const stripe = (await import("@/lib/stripe")).getStripe();
  let totalRefunded = 0;
  let chargeAmount: number | null = null;
  let chargeId: string | null = null;
  try {
    // You can get the charge id either from refund.charge or by searching PI charges
    const candidateChargeId =
      typeof refund.charge === "string" ? refund.charge : refund.charge?.id ?? null;

    let charge: Stripe.Charge | null = null;
    if (candidateChargeId) {
      charge = await stripe.charges.retrieve(candidateChargeId);
    } else {
      // Fallback: list charges by PaymentIntent if needed
      const list = await stripe.charges.list({ payment_intent: piId, limit: 1 });
      charge = list.data[0] ?? null;
    }

    if (charge) {
      totalRefunded = typeof charge.amount_refunded === "number" ? charge.amount_refunded : 0;
      chargeAmount = typeof charge.amount === "number" ? charge.amount : null;
      chargeId = charge.id;
    }
  } catch (e) {
    log("refund.updated:charge_fetch_error", { message: e instanceof Error ? e.message : String(e) });
  }

  // Merge refund ids - include the current refund id regardless of expand
  const mergedIds = Array.from(new Set([...(booking.refundIds ?? []), refund.id]));

  let status: RefundStatus = RefundStatus.PARTIAL;
  if (chargeAmount != null && totalRefunded >= chargeAmount) status = RefundStatus.FULL;
  if (totalRefunded === 0) status = RefundStatus.NONE;

  await db.booking.update({
    where: { id: booking.id },
    data: {
      refundedAmountCents: totalRefunded,
      refundStatus: status,
      refundIds: mergedIds,
      stripeChargeId: booking.stripeChargeId ?? chargeId ?? booking.stripeChargeId,
    },
  });

  log("refund.updated:booking_synced", {
    bookingId: booking.id,
    refundedAmountCents: totalRefunded,
    refundStatus: status,
    refundId: refund.id,
  });
}
