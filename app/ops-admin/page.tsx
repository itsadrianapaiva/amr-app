import "server-only";
import { headers } from "next/headers";
import Link from "next/link";
import {
  verifySessionFromCookie,
  isOpsDashboardEnabled,
} from "@/lib/auth/session";
import { getAvailabilityWindow } from "@/lib/ops/availability";

/** Tiny helper: add N days without mutating the original date. */
function addDays(d: Date, n: number) {
  const copy = new Date(d.getTime());
  copy.setDate(copy.getDate() + n);
  return copy;
}

/**
 * Ops Admin — Availability (read-only)
 * - Server component: fetches availability [today → +30d]
 * - Shows grouped bookings by machine with a compact layout
 */
export default async function OpsAdminPage() {
  // 1) Feature flag sanity — main guard is middleware, this is a cheap extra.
  if (!isOpsDashboardEnabled()) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">Ops Admin</h1>
        <p className="text-sm text-muted-foreground mt-2">Dashboard disabled.</p>
      </div>
    );
  }

  // 2) Session (role is just for the greeting; middleware already enforced access).
  const cookieHeader = headers().get("cookie");
  const secret = process.env.AUTH_COOKIE_SECRET ?? "";
  const ver = await verifySessionFromCookie(cookieHeader, secret);
  const role = ver.ok ? ver.session.role : "unknown";

  // 3) Compute window [today → +30d]. (Lisbon UI normalization is done inside data layer.)
  const today = new Date();
  const to = addDays(today, 30);

  // 4) Fetch availability (CONFIRMED bookings overlapping the window).
  const windowData = await getAvailabilityWindow({ from: today, to });

  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ops Admin</h1>
          <p className="text-sm text-muted-foreground">
            Signed in as <span className="font-medium">{role}</span>
          </p>
        </div>
        <Link
          href="/logout?next=/ops-admin"
          className="inline-flex items-center rounded-lg border px-3 py-2 text-sm shadow-sm"
        >
          Logout
        </Link>
      </header>

      {/* Status card */}
      <section className="rounded-2xl border p-4 shadow-sm mb-4">
        <h2 className="text-lg font-medium mb-1">Status</h2>
        <p className="text-sm text-muted-foreground">
          Window: <code>{windowData.fromYmd}</code> → <code>{windowData.toYmd}</code>
        </p>
      </section>

      {/* Availability */}
      <section className="rounded-2xl border p-4 shadow-sm">
        <h2 className="text-lg font-medium mb-3">Availability (next 30 days)</h2>

        {/* Empty state */}
        {windowData.machines.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No confirmed bookings in this window.
          </div>
        ) : (
          <div className="space-y-6">
            {windowData.machines.map((m) => (
              <div key={m.machineId} className="rounded-xl border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-medium">{m.machineName}</h3>
                  <span className="text-xs text-muted-foreground">
                    {m.bookings.length} booking{m.bookings.length === 1 ? "" : "s"}
                  </span>
                </div>

                {/* Mobile: stacked chips; Desktop: wraps nicely too */}
                {m.bookings.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No bookings.</div>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {m.bookings.map((b) => (
                      <li
                        key={b.id}
                        className="text-xs rounded-full border px-2 py-1"
                        title={`Booking #${b.id}`}
                      >
                        {b.startYmd} → {b.endYmd}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
