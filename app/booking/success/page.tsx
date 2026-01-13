import "server-only";
import Link from "next/link";
import { db } from "@/lib/db";
import Ga4Purchase from "@/components/analytics/ga4-purchase";
import BookingMetaPurchase from "@/components/analytics/booking-meta-purchase";
import { Button } from "@/components/ui/button";
import MetaCtaClickWrapper from "@/components/analytics/meta-cta-click";
import { CONTACTS } from "@/lib/content/contacts";

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

/**
 * Format a number as EUR currency.
 */
function formatEUR(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
  }).format(value);
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
      machine: { select: { id: true, name: true, deposit: true } },
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
  searchParams?: Promise<{ booking_id?: string; session_id?: string }>;
}) {
  const resolvedParams = await searchParams;
  const bookingIdParam = resolvedParams?.booking_id;
  const bookingId = Number(bookingIdParam);

  // Guardrail: if we do not have a numeric booking id, show a gentle error.
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
        <div className="flex items-center gap-3">
          <MetaCtaClickWrapper
            ctaType="success_go_home"
            ctaText="Go to homepage"
            ctaDestination="/"
            ctaLocation="booking_success"
          >
            <Link
              href="/"
              className="rounded-md bg-black px-4 py-2 text-white cursor-pointer"
            >
              Go to homepage
            </Link>
          </MetaCtaClickWrapper>

          <MetaCtaClickWrapper
            ctaType="success_back_to_catalog"
            ctaText="Browse machines"
            ctaDestination="/catalog"
            ctaLocation="booking_success"
          >
            <Button
              asChild
              className="rounded-md px-4 py-2 text-sm font-medium cursor-pointer"
            >
              <Link href="/catalog">
                Browse machines
              </Link>
            </Button>
          </MetaCtaClickWrapper>
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
        <div className="flex items-center gap-3">
          <MetaCtaClickWrapper
            ctaType="success_go_home"
            ctaText="Go to homepage"
            ctaDestination="/"
            ctaLocation="booking_success"
          >
            <Link
              href="/"
              className="rounded-md bg-black px-4 py-2 text-white cursor-pointer"
            >
              Go to homepage
            </Link>
          </MetaCtaClickWrapper>

          <MetaCtaClickWrapper
            ctaType="success_back_to_catalog"
            ctaText="Browse machines"
            ctaDestination="/catalog"
            ctaLocation="booking_success"
          >
            <Button
              asChild
              className="rounded-md px-4 py-2 text-sm font-medium cursor-pointer"
            >
              <Link href="/catalog">
                Browse machines
              </Link>
            </Button>
          </MetaCtaClickWrapper>
        </div>
      </div>
    );
  }

  const start = formatYmdLisbon(booking.startDate);
  const end = formatYmdLisbon(booking.endDate);

  // Safely coerce Prisma Decimal -> number for GA4
  const purchaseValue = Number(booking.totalCost);
  const depositValue = Number(booking.machine?.deposit ?? 0);

  // WhatsApp link (message-only, not tel:)
  const whatsappUrl = "https://wa.me/351934014611";
  const whatsappDisplay = CONTACTS.support.whatsapp.display;
  const supportEmail = CONTACTS.support.email;

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      {/* Header */}
      <div className="space-y-3">
        <h1 className="text-3xl font-bold">Booking confirmed</h1>
        <p className="text-sm text-gray-700">
          Thank you! Your booking has been recorded. You should receive an email
          with the next steps.
        </p>
      </div>

      {/* Booking Reference */}
      <div className="rounded-lg border bg-gray-50 p-4">
        <div className="mb-3">
          <span className="text-sm font-semibold text-gray-600">Booking reference</span>
          <p className="mt-1 text-xl font-mono font-bold">#{booking.id}</p>
          <p className="mt-1 text-xs text-gray-600">
            Please include this reference if you contact us.
          </p>
        </div>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 border-t border-gray-200 pt-3 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-gray-600">Machine</dt>
            <dd className="mt-1 text-sm font-medium">{booking.machine?.name ?? "Selected machine"}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-600">Start date</dt>
            <dd className="mt-1 text-sm font-medium">{start}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-600">End date</dt>
            <dd className="mt-1 text-sm font-medium">{end}</dd>
          </div>
        </dl>
      </div>

      {/* What happens next */}
      <div className="space-y-3">
        <h2 className="text-xl font-semibold">What happens next</h2>
        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-gray-400">•</span>
            <span>You will receive a confirmation email with full booking details.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-gray-400">•</span>
            <span>Our team will contact you before delivery to confirm logistics.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-gray-400">•</span>
            <span>The security deposit is paid at handover and is fully refundable.</span>
          </li>
        </ul>
      </div>

      {/* Payment summary */}
      <div className="rounded-lg border bg-gray-50 p-4">
        <h2 className="mb-3 text-lg font-semibold">Payment summary</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-gray-600">Total paid (incl. VAT)</dt>
            <dd className="font-semibold">{formatEUR(purchaseValue)}</dd>
          </div>
          {depositValue > 0 && (
            <div className="flex items-center justify-between">
              <dt className="text-gray-600">Refundable deposit</dt>
              <dd className="font-semibold">{formatEUR(depositValue)}</dd>
            </div>
          )}
          <div className="border-t border-gray-200 pt-2 text-xs text-gray-500">
            VAT at 23% included.
          </div>
        </dl>
      </div>

      {/* Support */}
      <div className="rounded-lg border bg-blue-50 p-4">
        <h2 className="mb-3 text-lg font-semibold">Need help?</h2>
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <span className="font-medium text-gray-700">WhatsApp us:</span>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900"
            >
              {whatsappDisplay}
            </a>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-medium text-gray-700">Email:</span>
            <a
              href={`mailto:${supportEmail}`}
              className="font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900"
            >
              {supportEmail}
            </a>
          </div>
          {CONTACTS.support.responseTimeNote && (
            <p className="mt-2 text-xs text-gray-600">
              {CONTACTS.support.responseTimeNote}
            </p>
          )}
        </div>
      </div>

      {/* CTAs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <MetaCtaClickWrapper
          ctaType="success_back_to_catalog"
          ctaText="Back to catalog"
          ctaDestination="/catalog"
          ctaLocation="booking_success"
        >
          <Button
            asChild
            className="rounded-md bg-black text-white px-6 py-2 text-sm font-medium cursor-pointer"
          >
            <Link href="/catalog">
              Back to catalog
            </Link>
          </Button>
        </MetaCtaClickWrapper>

        <MetaCtaClickWrapper
          ctaType="success_whatsapp"
          ctaText="Contact on WhatsApp"
          ctaDestination={whatsappUrl}
          ctaLocation="booking_success"
        >
          <Button
            asChild
            variant="outline"
            className="rounded-md px-6 py-2 text-sm font-medium cursor-pointer"
          >
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Contact on WhatsApp
            </a>
          </Button>
        </MetaCtaClickWrapper>
      </div>

      {/* GA4 purchase fires once on mount */}
      <Ga4Purchase
        transactionId={String(booking.id)}
        value={purchaseValue}
        currency="EUR"
        items={[
          {
            item_id: String(booking.machine?.id ?? ""),
            item_name: booking.machine?.name ?? "Machine",
            quantity: 1,
            price: purchaseValue,
          },
        ]}
      />

      {/* Meta Pixel purchase fires once on mount with sessionStorage idempotency */}
      {Number.isFinite(purchaseValue) && (
        <BookingMetaPurchase
          bookingId={booking.id}
          value={purchaseValue}
          currency="EUR"
          machineId={booking.machine?.id ?? null}
          machineName={booking.machine?.name ?? null}
        />
      )}
    </div>
  );
}
