// Purpose: Try to place a manual-capture hold (off-session) for the remaining balance.
// Returns either "capturable" (hold placed) or a "requires_action" fallback URL (auth Checkout).

import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { upsertBalanceAuthorization } from "@/lib/stripe/webhook-service";
import { buildBalanceAuthorizationCheckoutSessionParams } from "@/lib/stripe/checkout";
import { createCheckoutSessionWithGuards } from "@/lib/stripe/create-session";
import type Stripe from "stripe";

/** Result union keeps the page lean and easy to branch on. */
export type OffSessionAuthResult =
  | {
      kind: "skipped";
      reason: "already_authorized" | "no_remaining" | "missing_customer_or_pm";
    }
  | { kind: "capturable"; paymentIntentId: string; amountCents: number }
  | { kind: "requires_action"; checkoutUrl: string }
  | { kind: "error"; message: string };

/** Extract payment_method id from a Checkout Session (expanded PI if present). */
function paymentMethodIdFromSession(
  session: Stripe.Checkout.Session
): string | null {
  const pi = session.payment_intent;
  if (!pi || typeof pi === "string") return null;
  const pm = pi.payment_method;
  return pm ? (typeof pm === "string" ? pm : (pm.id ?? null)) : null;
}

/**
 * attemptOffSessionAuthorizationForBooking
 * - Computes remaining amount from DB.
 * - If needed, attempts a manual-capture PI with confirm+off_session using the deposit card.
 * - Falls back to building an authorization Checkout Session URL when SCA is required or data is missing.
 */
export async function attemptOffSessionAuthorizationForBooking(
  bookingId: number,
  session: Stripe.Checkout.Session
): Promise<OffSessionAuthResult> {
  try {
    // 1) Load booking to compute remaining and check if already authorized.
    const booking = await db.booking.findUnique({
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
    if (!booking) return { kind: "error", message: "Booking not found." };
    if (booking.authorizedPaymentIntentId) {
      return { kind: "skipped", reason: "already_authorized" };
    }

    const totalEuros = Number(booking.totalCost);
    const depositEuros = Number(booking.machine.deposit);
    const remainingEuros = Math.max(0, totalEuros - depositEuros);
    if (remainingEuros <= 0) return { kind: "skipped", reason: "no_remaining" };

    // 2) Pull Customer + the exact card used for the deposit (saved by setup_future_usage).
    const customerId =
      typeof session.customer === "string"
        ? session.customer
        : (session.customer?.id ?? null);
    const paymentMethodId = paymentMethodIdFromSession(session);
    if (!customerId || !paymentMethodId) {
      // Missing identity to try off-session -> fall back to a customer-facing auth Checkout
      return await buildFallbackAuth(booking, remainingEuros, customerId);
    }

    // 3) Attempt a silent off-session authorization (manual capture).
    const stripe = getStripe();
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(remainingEuros * 100),
      currency: "eur",
      customer: customerId,
      payment_method: paymentMethodId,
      capture_method: "manual",
      confirm: true,
      off_session: true, // try without customer interaction (may return requires_action)
      description: `Balance authorization for booking ${bookingId}`,
      metadata: {
        bookingId: String(bookingId),
        machineId: String(booking.machine.id),
        flow: "balance_authorize",
      },
    });

    // 4) Success path: hold placed -> store PI id + amount, return capturable.
    if (intent.status === "requires_capture") {
      await upsertBalanceAuthorization({
        bookingId,
        paymentIntentId: intent.id,
        amountCents: intent.amount_capturable,
      });
      return {
        kind: "capturable",
        paymentIntentId: intent.id,
        amountCents: intent.amount_capturable,
      };
    }

    // 5) SCA needed -> build an authorization Checkout to complete verification.
    if (intent.status === "requires_action") {
      return await buildFallbackAuth(booking, remainingEuros, customerId);
    }

    // Any other unexpected state: fall back gracefully.
    return await buildFallbackAuth(booking, remainingEuros, customerId);
  } catch (err: any) {
    // Typical off-session failures include 'authentication_required' or 'card_declined'.
    const code: string | undefined = err?.code ?? err?.raw?.code;
    if (code === "authentication_required" || code === "card_declined") {
      const booking = await db.booking.findUnique({
        where: { id: bookingId },
        select: {
          id: true,
          totalCost: true,
          customerEmail: true,
          startDate: true,
          endDate: true,
          machine: { select: { id: true, name: true, deposit: true } },
        },
      });
      if (booking) {
        const remainingEuros = Math.max(
          0,
          Number(booking.totalCost) - Number(booking.machine.deposit)
        );
        return await buildFallbackAuth(
          booking,
          remainingEuros,
          typeof session.customer === "string"
            ? session.customer
            : (session.customer?.id ?? null)
        );
      }
    }
    return { kind: "error", message: "Authorization attempt failed." };
  }
}

/** Builds a card-only authorization Checkout Session and returns its URL (customer-facing). */
async function buildFallbackAuth(
  booking: {
    id: number;
    totalCost: any;
    customerEmail: string;
    startDate: Date;
    endDate: Date;
    machine: { id: number; name: string; deposit: any };
  },
  remainingEuros: number,
  customerId: string | null
): Promise<OffSessionAuthResult> {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:3000";

  // Customer-friendly URLs (success returns to booking success; cancel returns to machine page).
  const successUrl = `${appUrl}/booking/success?booking_id=${booking.id}&session_id={CHECKOUT_SESSION_ID}&auth=1`;
  const cancelUrl = `${appUrl}/machine/${booking.machine.id}?auth_cancelled=1&booking_id=${booking.id}`;

  const params = buildBalanceAuthorizationCheckoutSessionParams({
    bookingId: booking.id,
    machine: { id: booking.machine.id, name: booking.machine.name },
    from: booking.startDate,
    to: booking.endDate,
    authorizeEuros: remainingEuros,
    customerEmail: booking.customerEmail,
    appUrl,
    // bind to same Customer to avoid creating new customers in fallback
    customerId: customerId ?? undefined,
    // explicit customer-facing URLs (avoid /ops)
    successUrlOverride: successUrl,
    cancelUrlOverride: cancelUrl,
  });

  const session = await createCheckoutSessionWithGuards(params, {
    idempotencyKey: `booking-${booking.id}-balance-auth-fallback`,
    log: (e, d) => console.debug(`[stripe] ${e}`, d),
  });

  if (!session.url)
    return { kind: "error", message: "Failed to create fallback Checkout." };
  return { kind: "requires_action", checkoutUrl: session.url };
}
