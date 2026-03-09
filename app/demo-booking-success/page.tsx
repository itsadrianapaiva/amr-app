import Link from "next/link";
import { Button } from "@/components/ui/button";
import MetaCtaClickWrapper from "@/components/analytics/meta-cta-click";
import { CONTACTS } from "@/lib/content/contacts";
import { formatCurrency } from "@/lib/utils";

export default function DemoBookingSuccessPage() {
  const demoBooking = {
    id: "DEMO-4821",
    machineName: "Mini Excavator 1.8T",
    startDate: "10/04/2026",
    endDate: "13/04/2026",
    totalCost: 420,
    deposit: 300,
  };

  const whatsappUrl = "https://wa.me/351934014611";
  const whatsappDisplay = CONTACTS.support.whatsapp.display;
  const supportEmail = CONTACTS.support.email;

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      {/* Header */}
      <div className="space-y-3">
        <h1 className="text-3xl font-bold">Demo booking created</h1>
        <p className="text-sm text-gray-700">
          This is a demonstration environment for portfolio purposes. No real
          payment or reservation has been created.
        </p>
      </div>

      {/* Booking Reference */}
      <div className="rounded-lg border bg-gray-50 p-4">
        <div className="mb-3">
          <span className="text-sm font-semibold text-gray-600">
            Demo booking reference
          </span>
          <p className="mt-1 text-xl font-mono font-bold">#{demoBooking.id}</p>
          <p className="mt-1 text-xs text-gray-600">
            Demo data used for portfolio display.
          </p>
        </div>

        <dl className="space-y-3 border-t border-gray-200 pt-3">
          <div>
            <dt className="text-sm text-gray-600">Machine</dt>
            <dd className="mt-1 text-sm font-medium">
              {demoBooking.machineName}
            </dd>
          </div>

          <div className="grid grid-cols-2 gap-x-6">
            <div>
              <dt className="text-sm text-gray-600">Start date</dt>
              <dd className="mt-1 text-sm font-medium">
                {demoBooking.startDate}
              </dd>
            </div>

            <div>
              <dt className="text-sm text-gray-600">End date</dt>
              <dd className="mt-1 text-sm font-medium">
                {demoBooking.endDate}
              </dd>
            </div>
          </div>
        </dl>
      </div>

      {/* What happens next */}
      <div className="space-y-3">
        <h2 className="text-xl font-semibold">What happens next</h2>

        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-gray-400">•</span>
            <span>This demo shows the booking confirmation flow.</span>
          </li>

          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-gray-400">•</span>
            <span>No payment has been processed.</span>
          </li>

          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-gray-400">•</span>
            <span>
              The real platform integrates Stripe Checkout and automated booking
              workflows.
            </span>
          </li>
        </ul>
      </div>

      {/* Payment summary */}
      <div className="rounded-lg border bg-gray-50 p-4">
        <h2 className="mb-3 text-lg font-semibold">Payment summary (demo)</h2>

        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-gray-600">Booking total</dt>
            <dd className="font-semibold">
              {formatCurrency(demoBooking.totalCost)}
            </dd>
          </div>

          <div className="flex items-center justify-between">
            <dt className="text-gray-600">Refundable deposit</dt>
            <dd className="font-semibold">
              {formatCurrency(demoBooking.deposit)}
            </dd>
          </div>

          <div className="border-t border-gray-200 pt-2 text-xs text-gray-500">
            Payments are disabled in this public demo.
          </div>
        </dl>
      </div>

      {/* Support */}
      <div className="rounded-lg border bg-blue-50 p-4">
        <h2 className="mb-3 text-lg font-semibold">
          Questions about the project?
        </h2>

        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <span className="font-medium text-gray-700">WhatsApp:</span>

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
        </div>
      </div>

      {/* CTA */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <MetaCtaClickWrapper
          ctaType="demo_back_to_catalog"
          ctaText="Back to catalog"
          ctaDestination="/catalog"
          ctaLocation="demo_success"
        >
          <Button
            asChild
            className="rounded-md bg-black text-white px-6 py-2 text-sm font-medium cursor-pointer"
          >
            <Link href="/catalog">Back to catalog</Link>
          </Button>
        </MetaCtaClickWrapper>

        <Button
          asChild
          variant="outline"
          className="rounded-md px-6 py-2 text-sm font-medium cursor-pointer"
        >
          <Link href="/">Go to homepage</Link>
        </Button>
      </div>
    </div>
  );
}
