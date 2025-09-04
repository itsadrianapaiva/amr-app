// app/api/stripe/webhook/route.ts
// Webhook to promote bookings after Stripe Checkout completes.

import { NextRequest } from "next/server";
import Stripe from "stripe";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { BookingStatus } from "@prisma/client";
import { notifyBookingConfirmed } from "@/lib/notifications/notify-booking-confirmed";

// Run on Node runtime (Stripe needs raw body) and never cache
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// --- tiny logger so we can filter in Vercel logs
function log(...args: any[]) {
  console.log("[stripe:webhook]", ...args);
}

/** Env guard */
function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable: ${name}`);
  return v;
}

/** Extract PI id in a type-safe way */
function paymentIntentIdFromSession(
  session: Stripe.Checkout.Session
): string | null {
  const pi = session.payment_intent;
  if (!pi) return null;
  return typeof pi === "string" ? pi : pi.id;
}

/** Robustly extract bookingId: prefer metadata, fallback to client_reference_id */
function bookingIdFromSession(session: Stripe.Checkout.Session): number | null {
  const metaId = session.metadata?.bookingId;
  if (metaId && Number.isFinite(Number(metaId))) return Number(metaId);
  const ref = session.client_reference_id;
  if (ref && Number.isFinite(Number(ref))) return Number(ref);
  return null;
}

/** Idempotent promotion: PENDING -> CONFIRMED, clear hold window, attach PI */
async function promoteBookingToConfirmed(args: {
  bookingId: number;
  paymentIntentId: string | null;
}) {
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
      log("promote: booking not found", { bookingId: args.bookingId });
      return; // ack anyway
    }

    // If already confirmed + paid, nothing to do (idempotent)
    if (existing.status === BookingStatus.CONFIRMED && existing.depositPaid) {
      log("promote: already confirmed", { bookingId: existing.id });
      return;
    }

    await tx.booking.update({
      where: { id: args.bookingId },
      data: {
        status: BookingStatus.CONFIRMED,
        depositPaid: true,
        holdExpiresAt: null, // clear hold on success
        stripePaymentIntentId:
          args.paymentIntentId ?? existing.stripePaymentIntentId ?? null,
      },
    });

    log("promote: booking updated", {
      bookingId: args.bookingId,
      attachedPI: args.paymentIntentId ?? null,
    });
  });
}

/** Cancel a still-pending booking (used on session.expired) — idempotent */
async function cancelPendingBooking(bookingId: number) {
  const res = await db.booking.updateMany({
    where: { id: bookingId, status: BookingStatus.PENDING },
    data: { status: BookingStatus.CANCELLED, holdExpiresAt: null },
  });
  log("expired: cancelled pending", { bookingId, changed: res.count });
}

// Route handler
export async function POST(req: NextRequest) {
  // 1) Read raw payload for signature verification
  const payload = await req.text();
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = requireEnv("STRIPE_WEBHOOK_SECRET");
  if (!sig) {
    log("missing stripe-signature");
    return new Response("Missing Stripe signature", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(payload, sig, webhookSecret);
  } catch (err) {
    log("signature verify failed", err instanceof Error ? err.message : err);
    // Reject so Stripe retries (useful during setup)
    return new Response("Signature verification failed", { status: 400 });
  }

  log("received", { type: event.type, id: event.id });

  // 2) Handle supported events
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const bookingId = bookingIdFromSession(session);
        if (bookingId == null) {
          log("completed: no bookingId", {
            client_reference_id: session.client_reference_id,
            metadata: session.metadata,
          });
          break;
        }

        const piId = paymentIntentIdFromSession(session);
        log("completed: promoting", {
          bookingId,
          sessionId: session.id,
          piId: piId ?? null,
        });

        await promoteBookingToConfirmed({ bookingId, paymentIntentId: piId });
        await notifyBookingConfirmed(bookingId, "customer");
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const bookingId = bookingIdFromSession(session);
        if (bookingId == null) {
          log("expired: no bookingId", {
            client_reference_id: session.client_reference_id,
            metadata: session.metadata,
          });
          break;
        }
        await cancelPendingBooking(bookingId);
        break;
      }

      default:
        // Keep a breadcrumb for other events during setup
        log("ignored", { type: event.type });
        break;
    }
  } catch (err) {
    // Prevent endless retries on our own errors; log and ack
    log("handler error", err instanceof Error ? err.message : err);
    return new Response("ok", { status: 200 });
  }

  // 3) Always acknowledge so Stripe doesn't spam retries for handled/unhandled events
  return new Response("ok", { status: 200 });
}
