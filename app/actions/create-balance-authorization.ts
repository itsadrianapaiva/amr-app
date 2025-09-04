"use server";

import { db } from "@/lib/db";
import { BookingStatus } from "@prisma/client";
import { buildBalanceAuthorizationCheckoutSessionParams } from "@/lib/stripe/checkout";
import { createCheckoutSessionWithGuards } from "@/lib/stripe/create-session";

export type CreateBalanceAuthResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * createBalanceAuthorization
 * Create a Stripe Checkout Session that AUTHORIZES (manual capture) the remaining balance.
 */
export async function createBalanceAuthorization(
  bookingId: number
): Promise<CreateBalanceAuthResult> {
  try {
    if (!Number.isFinite(bookingId)) {
      return { ok: false, error: "Invalid booking id." };
    }

    // 1) Load booking + machine to compute remaining balance
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        depositPaid: true,
        totalCost: true,
        customerEmail: true,
        startDate: true,
        endDate: true,
        machine: { select: { id: true, name: true, deposit: true } },
      },
    });

    if (!booking) return { ok: false, error: "Booking not found." };
    if (booking.status !== BookingStatus.CONFIRMED) {
      return { ok: false, error: "Booking is not CONFIRMED." };
    }
    if (!booking.depositPaid) {
      return { ok: false, error: "Deposit not paid yet." };
    }

    // 2) Compute remaining = total - deposit (Decimal -> number)
    const totalEuros = Number(booking.totalCost);
    const depositEuros = Number(booking.machine.deposit);
    const remaining = Math.max(0, totalEuros - depositEuros);
    if (remaining <= 0) {
      return { ok: false, error: "No remaining balance to authorize." };
    }

    // 3) Build manual-capture session and create with guards
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      "http://localhost:3000";

    const params = buildBalanceAuthorizationCheckoutSessionParams({
      bookingId: booking.id,
      machine: { id: booking.machine.id, name: booking.machine.name },
      from: booking.startDate,
      to: booking.endDate,
      authorizeEuros: remaining,
      customerEmail: booking.customerEmail,
      appUrl,
    });

    const session = await createCheckoutSessionWithGuards(params, {
      idempotencyKey: `booking-${booking.id}-balance-auth`,
      log: (e, d) => console.debug(`[stripe] ${e}`, d),
    });

    if (!session.url) {
      return { ok: false, error: "Stripe did not return a session URL." };
    }
    return { ok: true, url: session.url };
  } catch (err) {
    console.error("[actions] createBalanceAuthorization failed:", err);
    return { ok: false, error: "Unexpected server error." };
  }
}
