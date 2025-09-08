// app/booking/success/page.tsx
import { redirect } from "next/navigation";
import { BookingStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import ClearBookingDraft from "@/components/booking/clear-draft-on-mount";

import {
  getMetaFromCheckoutSession,
  getPaymentIntentId,
  isPaymentComplete,
  type MinimalCheckoutSession,
} from "@/lib/stripe/checkout-session";

// Ensure Node runtime for Stripe
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ session_id?: string }>;
};

export default async function SuccessPage({ searchParams }: PageProps) {
  const { session_id } = await searchParams;
  const sessionId = session_id;

  if (!sessionId) redirect("/");

  const stripe = getStripe();

  // Retrieve the Checkout Session (expand PI so our helpers can read status/id)
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent"],
  });
  const s: MinimalCheckoutSession = session as unknown as MinimalCheckoutSession;

  // Unified “paid” check + PI id + booking-related metadata
  const paid = isPaymentComplete(s);
  const piId = getPaymentIntentId(s);
  const { bookingId, machineId, startDate, endDate } = getMetaFromCheckoutSession(s);

  // If we lack booking id, render minimal info
  if (!Number.isFinite(bookingId)) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        <h1 className="text-2xl font-semibold">Payment received</h1>
        <p className="text-sm text-gray-700">
          We could not match your booking automatically. Our team will follow up.
        </p>
        <div className="flex items-center gap-3 pt-2">
          <a href="/" className="underline">Back to homepage</a>
        </div>
      </div>
    );
  }

  // Idempotent promotion to CONFIRMED + always clear lingering hold on success page
  let didPromote = false;
  await db.$transaction(async (tx) => {
    const existing = await tx.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        depositPaid: true, // reuse for "paid" until we rename the column
        stripePaymentIntentId: true,
        holdExpiresAt: true, // clear this on success
      },
    });
    if (!existing) return;

    // Promote if paid and not already recorded (webhook may be slow)
    if (paid && !existing.depositPaid && !existing.stripePaymentIntentId && piId) {
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          stripePaymentIntentId: piId,
          depositPaid: true, // TODO: rename to "paid" in a later migration
          status: BookingStatus.CONFIRMED,
          holdExpiresAt: null,
        },
      });
      didPromote = true;
      return;
    }

    // If already CONFIRMED (likely via webhook) but the hold timestamp lingers, clear it.
    if (existing.status === BookingStatus.CONFIRMED && existing.holdExpiresAt !== null) {
      await tx.booking.update({
        where: { id: bookingId },
        data: { holdExpiresAt: null },
      });
    }
  });

  // Best-effort revalidation via API route (allowed outside render)
  if (didPromote) {
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000";
    try {
      const body = typeof machineId === "number" ? { machineId } : {};
      await fetch(`${appUrl}/api/revalidate-after-confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(body),
      });
    } catch {
      // Non-fatal: UI still renders; stale pages will update on next request.
    }
  }

  // ——— UI
  const title = paid ? "Booking confirmed" : "Payment pending confirmation";
  const message = paid
    ? "Thank you. Your payment was processed successfully. A refundable deposit is due at handover (delivery or warehouse)."
    : "Thanks! Your payment is being confirmed. This can take a few minutes with MB WAY or IBAN. We’ll email you once it’s approved.";

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      {/* clear the per-machine draft now that we're on the success page */}
      {typeof machineId === "number" && <ClearBookingDraft machineId={machineId} />}

      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-sm text-gray-700">{message}</p>

      <div className="rounded-md border bg-gray-50 p-4 text-sm text-gray-800">
        <div className="space-y-1">
          <p>
            Booking ID: <span className="font-medium text-foreground">{bookingId}</span>
          </p>
          {startDate && endDate && (
            <p>
              Dates:{" "}
              <span className="font-medium text-foreground">{startDate}</span> to{" "}
              <span className="font-medium text-foreground">{endDate}</span>
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <a href="/" className="rounded-md bg-black px-4 py-2 text-white">Back to homepage</a>
        {typeof machineId === "number" && (
          <a href={`/machine/${machineId}`} className="underline">
            View machine
          </a>
        )}
      </div>
    </div>
  );
}
