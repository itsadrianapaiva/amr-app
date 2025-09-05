// lib/stripe/offsession/service.ts
// Lean orchestrator for off-session balance authorization (manual-capture hold).

import type Stripe from "stripe";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { upsertBalanceAuthorization } from "@/lib/stripe/webhook-service";
import {
  type OffSessionAuthResult,
  type MinimalBooking,
  computeRemainingEuros,
  getCustomerIdFromSession,
  getPaymentMethodIdFromSession,
  logDebug,
} from "./domain";
import { buildFallbackAuthCheckout } from "./fallback";

/** Fetch the minimal booking shape we need for the flow. */
async function loadMinimalBooking(
  bookingId: number
): Promise<MinimalBooking | null> {
  const b = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      totalCost: true,
      authorizedPaymentIntentId: true,
      customerEmail: true,
      startDate: true,
      endDate: true,
      machine: { select: { id: true, name: true, deposit: true } },
    },
  });
  if (!b) return null;
  return {
    id: b.id,
    totalCost: b.totalCost,
    customerEmail: b.customerEmail,
    startDate: b.startDate,
    endDate: b.endDate,
    machine: {
      id: b.machine.id,
      name: b.machine.name,
      deposit: b.machine.deposit,
    },
    authorizedPaymentIntentId: b.authorizedPaymentIntentId,
  };
}

/** Try off-session authorization; fall back to a verification Checkout when needed. */
export async function attemptOffSessionAuthorizationForBooking(
  bookingId: number,
  session: Stripe.Checkout.Session
): Promise<OffSessionAuthResult> {
  const booking = await loadMinimalBooking(bookingId);
  if (!booking) return { kind: "error", message: "Booking not found." };

  if (booking.authorizedPaymentIntentId) {
    logDebug("skip: already_authorized", { bookingId });
    return { kind: "skipped", reason: "already_authorized" };
  }

  const remainingEuros = computeRemainingEuros(
    booking.totalCost,
    booking.machine.deposit
  );
  if (remainingEuros <= 0) {
    logDebug("skip: no_remaining", {
      bookingId,
      total: booking.totalCost,
      deposit: booking.machine.deposit,
    });
    return { kind: "skipped", reason: "no_remaining" };
  }

  // Identity from deposit Checkout.
  const customerId = getCustomerIdFromSession(session);
  let paymentMethodId = getPaymentMethodIdFromSession(session);

  // If PI didn't expose a PM, fall back to newest card on the Customer.
  if (!paymentMethodId && customerId) {
    try {
      const stripe = getStripe();
      const list = await stripe.paymentMethods.list({
        customer: customerId,
        type: "card",
        limit: 1,
      });
      paymentMethodId = list.data?.[0]?.id ?? null;
      if (paymentMethodId)
        logDebug("fallback PM from customer", {
          bookingId,
          customerId,
          paymentMethodId,
        });
    } catch (e) {
      logDebug("paymentMethods.list failed", { bookingId });
    }
  }

  // If we still lack identity or card, build a customer-facing verification Checkout.
  if (!customerId || !paymentMethodId) {
    logDebug("missing_customer_or_pm → fallback Checkout", {
      bookingId,
      hasCustomer: !!customerId,
      hasPM: !!paymentMethodId,
    });
    return buildFallbackAuthCheckout({ booking, remainingEuros, customerId });
  }

  // Attempt a silent off-session manual-capture authorization.
  try {
    const stripe = getStripe();
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(remainingEuros * 100),
      currency: "eur",
      customer: customerId,
      payment_method: paymentMethodId,
      capture_method: "manual",
      confirm: true,
      off_session: true,
      description: `Balance authorization for booking ${bookingId}`,
      metadata: {
        bookingId: String(bookingId),
        machineId: String(booking.machine.id),
        flow: "balance_authorize",
      },
    });

    if (intent.status === "requires_capture") {
      await upsertBalanceAuthorization({
        bookingId,
        paymentIntentId: intent.id,
        amountCents: intent.amount_capturable,
      });
      logDebug("capturable", {
        bookingId,
        intent: intent.id,
        capturable: intent.amount_capturable,
      });
      return {
        kind: "capturable",
        paymentIntentId: intent.id,
        amountCents: intent.amount_capturable,
      };
    }

    if (intent.status === "requires_action") {
      logDebug("requires_action → fallback Checkout", { bookingId });
      return buildFallbackAuthCheckout({ booking, remainingEuros, customerId });
    }

    logDebug("unexpected PI status → fallback", {
      bookingId,
      status: intent.status,
    });
    return buildFallbackAuthCheckout({ booking, remainingEuros, customerId });
  } catch (err: any) {
    const code: string | undefined = err?.code ?? err?.raw?.code;
    logDebug("error from PI create", {
      bookingId,
      code,
      message: err?.message,
    });
    // Typical: authentication_required/card_declined → ask customer to verify.
    return buildFallbackAuthCheckout({ booking, remainingEuros, customerId });
  }
}
