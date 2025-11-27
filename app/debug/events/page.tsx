import { notFound } from "next/navigation";
import DebugEventsPanel from "@/components/analytics/debug-events-panel";

/**
 * Debug Events Page - Non-production only
 * Provides manual testing UI for GA4 and Meta Pixel events
 *
 * This page is gated to prevent access in production environments.
 * Use this page on staging or local to validate tracking setup with dummy data.
 */
export default function DebugEventsPage() {
  // Environment gating: block access in production
  const env = process.env.NEXT_PUBLIC_ENV || process.env.NODE_ENV;

  if (env === "production") {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="mx-auto max-w-4xl px-4">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">
            Analytics Debug Events
          </h1>
          <p className="text-gray-600">
            Internal testing page for GA4 and Meta Pixel tracking
          </p>
        </div>

        <div className="mb-6 rounded-lg border border-amber-400 bg-amber-50 p-4">
          <h2 className="mb-2 font-semibold text-amber-900">
            ⚠️ For Testing Only
          </h2>
          <ul className="space-y-1 text-sm text-amber-800">
            <li>• This page is only available on staging and local environments</li>
            <li>• All events use dummy data and do not affect real bookings</li>
            <li>
              • Check GA4 DebugView and Meta Events Manager to verify events are
              received
            </li>
            <li>
              • Add <code className="rounded bg-amber-200 px-1">?debug_mode=1</code>{" "}
              to see detailed console logs
            </li>
          </ul>
        </div>

        <DebugEventsPanel />
      </div>
    </div>
  );
}
