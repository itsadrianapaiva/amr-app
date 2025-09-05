import { redirect } from "next/navigation";
import { BookingStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import ClearBookingDraft from "@/components/booking/clear-draft-on-mount";

import { attemptOffSessionAuthorizationForBooking } from "@/lib/stripe/offsession-authorize";

// Ensure Node runtime for Stripe
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ session_id?: string }>;
};

// Helper: Read metadata we set on the Checkout Session
function getMeta(session: any) {
  const m = session?.metadata ?? {};
  return {
    bookingId: Number(session?.client_reference_id),
    machineId: m.machineId ? Number(m.machineId) : undefined,
    startDate: m.startDate as string | undefined,
    endDate: m.endDate as string | undefined,
  };
}

// Helper: normalize PI id regardless of expand behavior
function paymentIntentId(session: any): string | null {
  const pi = session?.payment_intent;
  if (!pi) return null;
  return typeof pi === "string" ? pi : (pi.id ?? null);
}

// Safely check if the PaymentIntent succeeded without violating the union
function paymentIntentSucceeded(session: any): boolean {
  const pi = session?.payment_intent;
  return typeof pi === "object" && pi?.status === "succeeded";
}

export default async function SuccessPage({ searchParams }: PageProps) {
  const { session_id } = await searchParams;
  const sessionId = session_id;

  if (!sessionId) {
    redirect("/");
  }

  const stripe = getStripe();

  // Retrieve the Checkout Session and expand payment_intent if possible
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent"],
  });

  // Use helper to avoid direct property access on a union
  const paid =
    session.payment_status === "paid" ||
    session.status === "complete" ||
    paymentIntentSucceeded(session);

  const piId = paymentIntentId(session);
  const { bookingId, machineId, startDate, endDate } = getMeta(session);

  // If we lack booking id, render minimal info
  if (!Number.isFinite(bookingId)) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        <h1 className="text-2xl font-semibold">Payment received</h1>
        <p className="text-sm text-gray-700">
          We could not match your booking automatically. Our team will follow
          up.
        </p>
        <div className="flex items-center gap-3 pt-2">
          <a href="/" className="underline">
            Back to homepage
          </a>
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
        depositPaid: true,
        stripePaymentIntentId: true,
        holdExpiresAt: true, //clear this on success
      },
    });

    if (!existing) return;

    // Promote if paid and not already recorded (webhook may be slow)
    if (
      paid &&
      !existing.depositPaid &&
      !existing.stripePaymentIntentId &&
      piId
    ) {
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          stripePaymentIntentId: piId,
          depositPaid: true,
          status: BookingStatus.CONFIRMED,
          holdExpiresAt: null,
        },
      });
      didPromote = true;
      return;
    }

    // If already CONFIRMED (likely via webhook) but the hold timestamp lingers, clear it.
    if (
      existing.status === BookingStatus.CONFIRMED &&
      existing.holdExpiresAt !== null
    ) {
      await tx.booking.update({
        where: { id: bookingId },
        data: { holdExpiresAt: null },
      });
    }
  });

  // Best-effort revalidation via API route (allowed outside render)
  if (didPromote) {
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      "http://localhost:3000";

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

  // Lean off-session authorization: delegate to the tiny service.
  // It will either (a) store the capturable PI and return 'capturable',
  // (b) return a fallback Checkout URL for SCA ('requires_action'), or
  // (c) skip when already authorized / no remaining / missing customer/pm.
  if (paid) {
    const result = await attemptOffSessionAuthorizationForBooking(
      bookingId,
      session
    );

    if (result.kind === "requires_action") {
      // Clear UX: this page is a quick verification, not a second charge.
      redirect(result.checkoutUrl);
    }
    // For 'capturable' | 'skipped' | 'error' we simply continue to render the success UI.
  }

  // ——— UI
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      {/* clear the per-machine draft now that we're on the success page */}
      {typeof machineId === "number" && (
        <ClearBookingDraft machineId={machineId} />
      )}

      <h1 className="text-2xl font-semibold">Booking confirmed</h1>
      <p className="text-sm text-gray-700">
        Thank you. Your deposit was processed successfully. We’re securing your
        card for the remaining balance (like a hotel hold). This isn’t another
        charge.
      </p>

      <div className="rounded-md border bg-gray-50 p-4 text-sm text-gray-800">
        <div className="space-y-1">
          <p>
            Booking ID:{" "}
            <span className="font-medium text-foreground">{bookingId}</span>
          </p>
          {startDate && endDate && (
            <p>
              Dates:{" "}
              <span className="font-medium text-foreground">{startDate}</span>{" "}
              to <span className="font-medium text-foreground">{endDate}</span>
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <a href="/" className="rounded-md bg-black px-4 py-2 text-white">
          Back to homepage
        </a>
        {typeof machineId === "number" && (
          <a href={`/machine/${machineId}`} className="underline">
            View machine
          </a>
        )}
      </div>
    </div>
  );
}
