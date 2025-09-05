import { redirect } from "next/navigation";
import { differenceInCalendarDays } from "date-fns";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { upsertBalanceAuthorization } from "@/lib/stripe/webhook-service";
import { buildDepositCheckoutSessionParams } from "@/lib/stripe/checkout";
import { createCheckoutSessionWithGuards } from "@/lib/stripe/create-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ booking_id?: string; session_id?: string }>;
};

// Small helpers
function paymentIntentId(session: any): string | null {
  const pi = session?.payment_intent;
  if (!pi) return null;
  return typeof pi === "string" ? pi : (pi?.id ?? null);
}

export default async function AuthorizeSuccessPage({
  searchParams,
}: PageProps) {
  const { booking_id, session_id } = await searchParams;
  if (!booking_id || !session_id) redirect("/");

  const bookingId = Number(booking_id);
  if (!Number.isFinite(bookingId)) redirect("/");

  // 1) Retrieve the auth Checkout Session to read PI + flow info
  const stripe = getStripe();
  const authSession = await stripe.checkout.sessions.retrieve(session_id, {
    expand: ["payment_intent"],
  });

  // Optional sanity: ensure we are in the auth flow
  const flow = String(authSession.metadata?.flow ?? "");
  if (flow.toLowerCase() !== "balance_authorize") {
    // If someone hits this URL without coming from auth, send home
    redirect("/");
  }

  // 2) Ensure the authorization is stored on the booking (id + amount)
  const piId = paymentIntentId(authSession);
  const amountTotalCents =
    typeof authSession.amount_total === "number"
      ? authSession.amount_total
      : null;

  if (piId) {
    await upsertBalanceAuthorization(
      {
        bookingId,
        paymentIntentId: piId,
        amountCents: amountTotalCents,
      }
      // logger omitted (no-op default)
    );
  }

  // 3) Create the DEPOSIT Checkout for the same booking and redirect to Stripe
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      customerEmail: true,
      startDate: true,
      endDate: true,
      machine: { select: { id: true, name: true, deposit: true } },
    },
  });

  if (!booking) redirect("/");

  const days = differenceInCalendarDays(booking.endDate, booking.startDate) + 1;

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:3000";

  const depositParams = buildDepositCheckoutSessionParams({
    bookingId: booking.id,
    machine: { id: booking.machine.id, name: booking.machine.name },
    from: booking.startDate,
    to: booking.endDate,
    days,
    depositEuros: Number(booking.machine.deposit),
    customerEmail: booking.customerEmail,
    appUrl,
  });

  const depositSession = await createCheckoutSessionWithGuards(depositParams, {
    idempotencyKey: `booking-${booking.id}-deposit`,
    log: (e, d) => console.debug(`[stripe] ${e}`, d),
  });

  if (depositSession.url) {
    redirect(depositSession.url);
  }

  // Fallback: if Stripe didn’t return a URL, go to normal success page
  redirect(`${appUrl}/booking/success?booking_id=${booking.id}`);
}
