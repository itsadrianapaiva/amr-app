import { redirect } from "next/navigation";
import { BookingStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import ClearBookingDraft from "@/components/booking/clear-draft-on-mount";

// Ensure Node runtime for Stripe
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ session_id?: string }>;
};

// Small helper: Read metadata we set on the Checkout Session
function getMeta(session: any) {
  const m = session?.metadata ?? {};
  return {
    bookingId: Number(session?.client_reference_id),
    machineId: m.machineId ? Number(m.machineId) : undefined,
    startDate: m.startDate as string | undefined,
    endDate: m.endDate as string | undefined,
  };
}

// Small helper: normalize PI id regardless of expand behavior
function paymentIntentId(session: any): string | null {
  const pi = session?.payment_intent;
  if (!pi) return null;
  return typeof pi === "string" ? pi : pi.id ?? null;
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

  // If we somehow lack booking id, show a simple explanation
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
        holdExpiresAt: true, // <-- NEW: we need to see if a hold remains
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
          holdExpiresAt: null, // <-- NEW: clear hold on promotion
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
        data: { holdExpiresAt: null }, // <-- NEW: clear lingering hold
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

  // ——— UI
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      {/* clear the per-machine draft now that we're on the success page */}
      {typeof machineId === "number" && (
        <ClearBookingDraft machineId={machineId} />
      )}

      <h1 className="text-2xl font-semibold">Booking confirmed</h1>
      <p className="text-sm text-gray-700">
        Thank you. Your deposit was processed successfully.
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
