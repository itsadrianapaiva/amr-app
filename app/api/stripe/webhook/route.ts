// Webhook to promote bookings after Stripe Checkout completes.

import { NextRequest } from "next/server";
import Stripe from "stripe";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { BookingStatus } from "@prisma/client";

// Run on Node runtime (Stripe needs raw body) and never cache
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Utility: env guard 
function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable: ${name}`);
  return v;
}

// Utility: extract PI id in a type-safe way 
function paymentIntentIdFromSession(session: Stripe.Checkout.Session): string | null {
  const pi = session.payment_intent;
  if (!pi) return null;
  return typeof pi === "string" ? pi : pi.id;
}

// Booking promotion 
async function promoteBookingToConfirmed(args: {
  bookingId: number;
  paymentIntentId: string;
}) {
  // Idempotency: if already confirmed or PI saved, this should be a no-op-like update
  // Use a transaction to keep state consistent.
  await db.$transaction(async (tx) => {
    const existing = await tx.booking.findUnique({
      where: { id: args.bookingId },
      select: { id: true, status: true, stripePaymentIntentId: true, depositPaid: true },
    });

    if (!existing) {
      // Booking disappeared or never existed — return silently (avoid Stripe retries).
      return;
    }

    // If already tied to a PI or confirmed, don't error, just return.
    if (existing.stripePaymentIntentId || existing.depositPaid) {
      return;
    }

    await tx.booking.update({
      where: { id: args.bookingId },
      data: {
        stripePaymentIntentId: args.paymentIntentId,
        depositPaid: true,
        status: BookingStatus.CONFIRMED,
      },
    });

    // TODO: Revalidate affected pages/tags if you’re using ISR/tagged caching
    // e.g., revalidateTag(`machine-${machineId}`) once you tag pages.
  });
}

// Route handler 
export async function POST(req: NextRequest) {
  // 1) Read raw payload for signature verification
  const payload = await req.text();
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = requireEnv("STRIPE_WEBHOOK_SECRET");

  if (!sig) {
    // Missing signature — reject
    return new Response("Missing Stripe signature", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(payload, sig, webhookSecret);
  } catch (err) {
    // Invalid signature — reject so Stripe can retry
    return new Response(
      err instanceof Error ? `Signature verification failed: ${err.message}` : "Signature verification failed",
      { status: 400 }
    );
  }

  // 2) Narrow on event type
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const ref = session.client_reference_id;
        const piId = paymentIntentIdFromSession(session);

        // Guardrails: both ref and payment intent required for promotion
        const bookingId = ref ? Number(ref) : NaN;
        if (!Number.isFinite(bookingId) || !piId) {
          // Don’t throw — acknowledge to prevent infinite retries; log for diagnostics
          console.warn("Checkout completed but missing bookingId or paymentIntentId", { ref, piId });
          break;
        }

        await promoteBookingToConfirmed({ bookingId, paymentIntentId: piId });
        break;
      }

      // Optional: acknowledge other events quietly for now
      case "checkout.session.expired":
      case "payment_intent.succeeded":
      case "payment_intent.payment_failed":
      default: {
        // Intentionally no-op; return 200 to avoid retries.
        break;
      }
    }
  } catch (err) {
    // Catch-all to prevent Stripe from retrying endlessly on our internal errors
    console.error("Webhook handler error", { type: event.type, err });
    // Return 200 so Stripe doesn't flood retries; you can monitor logs for this.
    return new Response("ok", { status: 200 });
  }

  // 3) Always 2xx so Stripe doesn't spam retries for handled/unhandled events
  return new Response("ok", { status: 200 });
}
