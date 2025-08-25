import { redirect } from "next/navigation";
import { BookingStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";

type PageProps = {
  searchParams: Promise<{ session_id?: string }>;
};

// Small helper: be lenient and return strings
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
            Back to catalog
          </a>
        </div>
      </main>
    );
  }

  // idempotent way
  // If the user refreshes this page, we do not double confirm.
  // Confirm booking if needed (no revalidatePath here)
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
    }
  });

  return (
    <main className="container mx-auto py-16">
      <h1 className="text-2xl font-semibold">Booking confirmed</h1>
      <p className="mt-2">Thank you. Your deposit was processed successfully.</p>

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
        <a href="/" className="underline">Back to catalog</a>
        {typeof machineId === "number" && (
          <a href={`/machine/${machineId}`} className="underline">Go to machine</a>
        )}
      </div>
    </main>
  );
}