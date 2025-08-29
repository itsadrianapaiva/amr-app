// Webhook to promote bookings after Stripe Checkout completes.

import { NextRequest } from "next/server";
import Stripe from "stripe";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { BookingStatus } from "@prisma/client";

// Run on Node runtime (Stripe needs raw body) and never cache
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    if (!existing) return; // silently ack; avoid Stripe retries

    // If already confirmed + paid, nothing to do (idempotent)
    if (existing.status === BookingStatus.CONFIRMED && existing.depositPaid)
      return;

    await tx.booking.update({
      where: { id: args.bookingId },
      data: {
        status: BookingStatus.CONFIRMED,
        depositPaid: true,
        holdExpiresAt: null, // clear hold on success
        // store PI if provided (helpful for support); keep null-safe
        stripePaymentIntentId:
          args.paymentIntentId ?? existing.stripePaymentIntentId ?? null,
      },
    });
  });
}

/** Cancel a still-pending booking (used on session.expired) — idempotent */
async function cancelPendingBooking(bookingId: number) {
  await db.booking.updateMany({
    where: { id: bookingId, status: BookingStatus.PENDING },
    data: { status: BookingStatus.CANCELLED, holdExpiresAt: null },
  });
}

// Route handler
export async function POST(req: NextRequest) {
  // 1) Read raw payload for signature verification
  const payload = await req.text();
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = requireEnv("STRIPE_WEBHOOK_SECRET");
  if (!sig) return new Response("Missing Stripe signature", { status: 400 });

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(payload, sig, webhookSecret);
  } catch (err) {
    // Invalid signature — reject so Stripe can retry
    return new Response(
      err instanceof Error
        ? `Signature verification failed: ${err.message}`
        : "Signature verification failed",
      { status: 400 }
    );
  }

  // 2) Handle supported events
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const bookingId = bookingIdFromSession(session);
        const piId = paymentIntentIdFromSession(session);

        if (!bookingId) {
          console.warn("Webhook completed without bookingId in metadata/ref", {
            client_reference_id: session.client_reference_id,
            metadata: session.metadata,
          });
          break; // ack but do nothing; prevents retries
        }

        await promoteBookingToConfirmed({ bookingId, paymentIntentId: piId });
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const bookingId = bookingIdFromSession(session);
        if (!bookingId) break;
        await cancelPendingBooking(bookingId);
        break;
      }

      // Quietly acknowledge other events for now
      default:
        break;
    }
  } catch (err) {
    // Prevent endless retries on our own errors; log and ack
    console.error("Webhook handler error", { type: event.type, err });
    return new Response("ok", { status: 200 });
  }

  // 3) Always acknowledge so Stripe doesn't spam retries for handled/unhandled events
  return new Response("ok", { status: 200 });
}
