// Tiny builder that creates a *verification-only* Checkout Session for SCA fallback.
// Pure orchestration: no DB reads. Returns { kind: "requires_action", checkoutUrl }.

import { createCheckoutSessionWithGuards } from "@/lib/stripe/create-session";
import { buildBalanceAuthorizationCheckoutSessionParams } from "@/lib/stripe/checkout.auth";
import type { OffSessionAuthResult, MinimalBooking } from "./domain";
import { euros2 } from "./domain";

/**
 * Build a customer-facing authorization Checkout Session (card verification, no charge).
 * Returns a URL the UI should redirect to.
 */
export async function buildFallbackAuthCheckout(opts: {
  booking: MinimalBooking;
  remainingEuros: number;
  customerId: string | null;
  appUrl?: string;
}): Promise<OffSessionAuthResult> {
  const { booking, remainingEuros, customerId } = opts;

  const appUrl =
    opts.appUrl ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:3000";

  // Success returns to booking success; cancel returns to machine page.
  const successUrl = `${appUrl}/booking/success?booking_id=${booking.id}&session_id={CHECKOUT_SESSION_ID}&auth=1`;
  const cancelUrl = `${appUrl}/machine/${booking.machine.id}?auth_cancelled=1&booking_id=${booking.id}`;

  // Crystal-clear reassurance shown under the submit button in Checkout.
  const submitMsg = `Verification only — no additional charge today. We’ll place a temporary hold up to €${euros2(
    remainingEuros
  )}. It’s captured only after your rental.`;

  const params = buildBalanceAuthorizationCheckoutSessionParams({
    bookingId: booking.id,
    machine: { id: booking.machine.id, name: booking.machine.name },
    from: booking.startDate,
    to: booking.endDate,
    authorizeEuros: remainingEuros,
    customerEmail: booking.customerEmail,
    appUrl,
    customerId: customerId ?? undefined, // bind to same Customer when possible
    successUrlOverride: successUrl,
    cancelUrlOverride: cancelUrl,
    customTextMessage: submitMsg,
  });

  const session = await createCheckoutSessionWithGuards(params, {
    idempotencyKey: `booking-${booking.id}-balance-auth-fallback`,
    log: (e, d) => console.debug(`[stripe] ${e}`, d),
  });

  if (!session.url)
    return { kind: "error", message: "Failed to create fallback Checkout." };
  return { kind: "requires_action", checkoutUrl: session.url };
}
