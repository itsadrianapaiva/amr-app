import "server-only";
import Link from "next/link";
import { db } from "@/lib/db";
import Ga4Purchase from "@/components/analytics/ga4-purchase";
// import ScrollLink from "@/components/nav/scroll-link";
import { Button } from "@/components/ui/button";

/**
 * Tiny helper to format a Date as YYYY-MM-DD in the Lisbon timezone,
 * avoiding off-by-one issues on server rendering.
 */
function formatYmdLisbon(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/** Narrow, page-local query: keep it focused and small. */
async function getBookingSummary(bookingId: number) {
  return db.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      totalCost: true, // needed for GA4 purchase value
      machine: { select: { id: true, name: true } },
      // We intentionally avoid pulling heavy relations here.
    },
  });
}

/**
 * Customer Success Page
 * - Reads `booking_id` from the query string (Stripe success_url already includes it).
 * - Loads a minimal booking summary and renders a friendly receipt.
 * - Sends a GA4 "purchase" event (value in EUR) once mounted on the client.
 */
export default async function CustomerSuccessPage({
  searchParams,
}: {
  searchParams?: { booking_id?: string; session_id?: string };
}) {
  const bookingIdParam = searchParams?.booking_id;
  const bookingId = Number(bookingIdParam);

  // Guardrail: if we don't have a numeric booking id, show a gentle error.
  if (!Number.isFinite(bookingId)) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        <h1 className="text-2xl font-semibold">We’re almost there</h1>
        <p className="text-sm text-gray-700">
          We couldn’t read your booking reference from the URL.
        </p>
        <div className="rounded-md border bg-amber-50 p-4 text-sm text-amber-900">
          <p>
            If you just completed payment, try reopening the success link from
            your browser history or check your inbox for the confirmation email.
          </p>
        </div>
      </div>
    );
  }

  const booking = await getBookingSummary(bookingId);

  // If the booking is missing (race / webhook lag / deleted), fail soft.
  if (!booking) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        <h1 className="text-2xl font-semibold">Booking located soon</h1>
        <p className="text-sm text-gray-700">
          We couldn’t find booking{" "}
          <span className="font-mono">#{bookingId}</span> yet.
        </p>
        <div className="rounded-md border bg-amber-50 p-4 text-sm text-amber-900">
          <p>
            This can happen for a minute after payment while systems sync. You
            should receive an email with the next steps. If nothing arrives,
            contact support with your payment receipt.
          </p>
        </div>
      </div>
    );
  }

  const start = formatYmdLisbon(booking.startDate);
  const end = formatYmdLisbon(booking.endDate);

  // Safely coerce Prisma Decimal -> number for GA4
  const purchaseValue = Number(booking.totalCost);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Booking confirmed</h1>

      <p className="text-sm text-gray-700">
        Thank you! Your booking has been recorded. You should receive an email
        with the next steps.
      </p>

      <div className="rounded-md border bg-gray-50 p-4 text-sm text-gray-900">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <div>
            <dt className="text-gray-600">Booking ID</dt>
            <dd className="font-mono">#{booking.id}</dd>
          </div>
          <div>
            <dt className="text-gray-600">Machine</dt>
            <dd>{booking.machine?.name ?? "Selected machine"}</dd>
          </div>
          <div>
            <dt className="text-gray-600">Start date</dt>
            <dd>{start}</dd>
          </div>
          <div>
            <dt className="text-gray-600">End date</dt>
            <dd>{end}</dd>
          </div>
        </dl>
      </div>

      {/* GA4 purchase: fires once on mount (no effect on SSR) */}
      <Ga4Purchase
        transactionId={String(booking.id)}
        value={purchaseValue}
        currency="EUR"
        items={[
          {
            item_id: String(booking.machine?.id ?? ""),
            item_name: booking.machine?.name ?? "Machine",
            quantity: 1,
          },
        ]}
      />
    </div>
  );
}
