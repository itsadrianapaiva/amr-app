import { redirect } from "next/navigation";
import { BookingStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import ClearBookingDraft from "@/components/booking/clear-draft-on-mount";
import { createAllDayEvent } from "@/lib/google-calendar";

// Ensure Node runtime for googleapis + Stripe
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
      <main className="container mx-auto py-16">
        <h1 className="text-2xl font-semibold">Payment received</h1>
        <p className="mt-2">
          We could not match your booking automatically. Our team will follow
          up.
        </p>
        <div className="mt-8">
          <a href="/" className="underline">
            Back to homepage
          </a>
        </div>
      </main>
    );
  }

  // If the user refreshes this page, we do not double confirm.
  // Confirm booking if needed (idempotent)
  let didPromote = false;
  await db.$transaction(async (tx) => {
    const existing = await tx.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        depositPaid: true,
        stripePaymentIntentId: true,
      },
    });

    if (!existing) return;

    // Only update if paid and not already confirmed
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
        },
      });
      didPromote = true;
    }
  });

  // 1) Create a Google Calendar event AFTER promotion (best-effort, non-blocking)
  if (didPromote && startDate && endDate) {
    try {
      // Fetch machine name for a nicer Calendar title
      const machineName =
        typeof machineId === "number"
          ? (
              await db.machine.findUnique({
                where: { id: machineId },
                select: { name: true },
              })
            )?.name ?? "Machine"
          : "Machine";

      const summary = `AMR Rental – ${machineName}`;
      const description = [
        `Booking #${bookingId}`,
        `Dates: ${startDate} → ${endDate}`,
        piId ? `PaymentIntent: ${piId}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      const eventId = await createAllDayEvent({
        summary,
        description,
        startDate, // inclusive; helper will add +1 day for Google end.date
        endDate, // inclusive
      });

      // Persist the Calendar event id (ignore if schema lacks the field)
      await db.booking.update({
        where: { id: bookingId },
        data: { googleCalendarEventId: eventId },
      });
    } catch (err) {
      // Do not fail the success page if Calendar write fails
      console.error("Calendar write failed:", err);
    }
  }

  // 2) Best-effort revalidation via API route (allowed outside render)
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

  return (
    <main className="container mx-auto py-16">
      {/* clear the per-machine draft now that we're on the success page */}
      {typeof machineId === "number" && (
        <ClearBookingDraft machineId={machineId} />
      )}

      <h1 className="text-2xl font-semibold">Booking confirmed</h1>
      <p className="mt-2">
        Thank you. Your deposit was processed successfully.
      </p>

      <div className="mt-6 grid gap-1 text-sm text-muted-foreground">
        <p>
          Booking ID:{" "}
          <span className="font-medium text-foreground">{bookingId}</span>
        </p>
        {startDate && endDate && (
          <p>
            Dates:{" "}
            <span className="font-medium text-foreground">{startDate}</span> to{" "}
            <span className="font-medium text-foreground">{endDate}</span>
          </p>
        )}
        {typeof machineId === "number" && (
          <p>
            Machine:{" "}
            <a href={`/machine/${machineId}`} className="underline">
              View machine
            </a>
          </p>
        )}
      </div>

      <div className="mt-8 flex gap-6">
        <a href="/" className="underline">
          Back to homepage
        </a>
        {typeof machineId === "number" && (
          <a href={`/machine/${machineId}`} className="underline">
            Go to machine
          </a>
        )}
      </div>
    </main>
  );
}
