import Link from "next/link";

/**
 * OpsSuccessPage
 * - App Router passes `searchParams` as a Promise in Next.js 16.
 * - Read bookingId directly and show it if present.
 */
export default async function OpsSuccessPage({
  searchParams,
}: {
  searchParams?: Promise<{ bookingId?: string }>;
}) {
  const resolvedParams = await searchParams;
  const bookingId = resolvedParams?.bookingId;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Booking created</h1>

      <p className="text-sm text-gray-700">
        Your booking was saved successfully in the system
        {bookingId ? ` (ID: ${bookingId})` : ""}.
      </p>

      <div className="rounded-md border bg-gray-50 p-4 text-sm text-gray-800">
        <p>
          Google Calendar integration is temporarily disabled for ops bookings.
          Records are safely stored in the database. We will re-enable calendar
          writes later without affecting this booking.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Link href="/ops" className="rounded-md bg-black px-4 py-2 text-white">
          Back to booking
        </Link>
        <Link href="/" className="underline">
          Go to homepage
        </Link>
      </div>
    </div>
  );
}
