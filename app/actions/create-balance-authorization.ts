"use server";

/**
 * Server action: create a Stripe Checkout Session that AUTHORIZES (does not capture)
 * the remaining balance for an existing booking, using manual capture.
 *
 * This keeps deposit flow isolated (no changes to create-deposit-checkout.ts).
 */

import { differenceInCalendarDays } from "date-fns";
import { db } from "@/lib/db";
import { buildBalanceAuthorizationSessionParams } from "@/lib/stripe/checkout";
import { createCheckoutSessionWithGuards } from "@/lib/stripe/create-session";

type Result = { ok: true; url: string } | { ok: false; formError: string };

/** Defensive number conversion for Prisma Decimal-like values. */
function asNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  // Prisma Decimal can stringify; fallback:
  try {
    return Number((v as any)?.toString?.() ?? v);
  } catch {
    return NaN;
  }
}

/**
 * createBalanceAuthorizationAction
 * Input: bookingId (number)
 * Behavior:
 *  - Loads booking + machine to compute days and remaining (total - deposit).
 *  - Builds a manual-capture Checkout Session (authorize now, capture later).
 *  - Returns a hosted URL (or a friendly error).
 */
export async function createBalanceAuthorizationAction(
  bookingId: number
): Promise<Result> {
  if (!Number.isFinite(bookingId)) {
    return { ok: false, formError: "Invalid booking ID." };
  }

  // 1) Load minimal fields needed to build the session
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      totalCost: true,
      customerEmail: true,
      machine: { select: { id: true, name: true, deposit: true } },
    },
  });

  if (!booking) {
    return { ok: false, formError: "Booking not found." };
  }

  const from = booking.startDate;
  const to = booking.endDate;
  const days = differenceInCalendarDays(to, from) + 1;

  const total = asNumber(booking.totalCost);
  const deposit = asNumber(booking.machine.deposit);
  const remaining = total - deposit;

  if (!Number.isFinite(total) || !Number.isFinite(deposit)) {
    return {
      ok: false,
      formError: "Invalid booking totals. Please contact support.",
    };
  }

  if (remaining <= 0) {
    return {
      ok: false,
      formError: "No remaining balance to authorize for this booking.",
    };
  }

  // 2) Build a manual-capture Checkout Session (authorize only)
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:3000";

  const sessionParams = buildBalanceAuthorizationSessionParams({
    bookingId: booking.id,
    machine: { id: booking.machine.id, name: booking.machine.name },
    from,
    to,
    days,
    authorizeEuros: remaining,
    customerEmail: booking.customerEmail,
    appUrl,
  });

  // 3) Create session with guard rails and a stable idempotency key
  const session = await createCheckoutSessionWithGuards(sessionParams, {
    idempotencyKey: `booking-${booking.id}-balance-auth`,
    log: (event, data) => console.debug(`[stripe] ${event}`, data),
  });

  if (!session.url) {
    return {
      ok: false,
      formError: "Stripe did not return a checkout URL. Please try again.",
    };
  }

  return { ok: true, url: session.url };
}
