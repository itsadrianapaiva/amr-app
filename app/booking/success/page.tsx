import { redirect } from "next/navigation";
import { BookingStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import ClearBookingDraft from "@/components/booking/clear-draft-on-mount";
import { createBalanceAuthorization } from "@/app/actions/create-balance-authorization";

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
  return typeof pi === "string" ? pi : pi.id ?? null;
}

// Helper: PaymentIntent succeeded check without violating unions
function paymentIntentSucceeded(session: any): boolean {
  const pi = session?.payment_intent;
  return typeof pi === "object" && pi?.status === "succeeded";
}

export default async function SuccessPage({ searchParams }: PageProps) {
  const { session_id } = await searchParams;
  const sessionId = session_id;
  if (!sessionId) redirect("/");

  const stripe = getStripe();
  // Retrieve Session and expand PI when possible
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent"],
  });

  // Determine if deposit is paid
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
          We could not match your booking automatically. Our team will follow up.
        </p>
        <div className="flex items-center gap-3 pt-2">
          <a href="/" className="underline">Back to homepage</a>
        </div>
      </div>
    );
  }

  // Idempotent promotion to CONFIRMED + clear lingering hold
  await db.$transaction(async (tx) => {
    const existing = await tx.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        depositPaid: true,
        stripePaymentIntentId: true,
        holdExpiresAt: true,
      },
    });
    if (!existing) return;

    // Promote if paid and not yet recorded
    if (paid && !existing.depositPaid && !existing.stripePaymentIntentId && piId) {
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          stripePaymentIntentId: piId,
          depositPaid: true,
          status: BookingStatus.CONFIRMED,
          holdExpiresAt: null,
        },
      });
      return;
    }

    // Clear lingering hold if already confirmed
    if (existing.status === BookingStatus.CONFIRMED && existing.holdExpiresAt !== null) {
      await tx.booking.update({
        where: { id: bookingId },
        data: { holdExpiresAt: null },
      });
    }
  });

  // Immediately start a manual-capture authorization for the remaining balance.
  // This is idempotent (stable idempotency key in the server action), so refreshes are safe.
  if (paid) {
    try {
      const auth = await createBalanceAuthorization(bookingId);
      if (auth.ok) {
        // Auto-redirect to Stripe to place the authorization hold (no customer choice).
        // Current success_url for this auth goes to /ops/success (fine for MVP).
        redirect(auth.url);
      }
      // If not ok, fall through and show a fallback message.
    } catch {
      // Fall through to fallback UI.
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

      <p className="text-sm text-gray-700">
        We’re preparing a card authorization for the remaining balance. If this page
        does not redirect automatically, our team will get in touch to finalize the hold.
      </p>

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
