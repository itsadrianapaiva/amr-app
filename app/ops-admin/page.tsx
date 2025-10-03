import "server-only";
import { headers } from "next/headers";
import Link from "next/link";
import {
  verifySessionFromCookie,
  isOpsDashboardEnabled,
} from "@/lib/auth/session";

/**
 * Minimal ops-admin shell.
 * - Runs only on the server.
 * - Double-checks feature flag and session (middleware already guards).
 * - Shows role, quick links, and a Logout.
 */
export default async function OpsAdminPage() {
  // Quick feature-flag guard (cheap sanity; main guard is middleware).
  if (!isOpsDashboardEnabled()) {
    // Keep it terse — this path should be unreachable in prod if matcher is correct.
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">Ops Admin</h1>
        <p className="text-sm text-muted-foreground mt-2">Dashboard disabled.</p>
      </div>
    );
  }

  // Verify session from raw Cookie header to get role for the greeting.
  const cookieHeader = headers().get("cookie");
  const secret = process.env.AUTH_COOKIE_SECRET ?? "";
  const ver = await verifySessionFromCookie(cookieHeader, secret);

  // If something went off (e.g., missing secret), show a lean fallback.
  const role = ver.ok ? ver.session.role : "unknown";

  return (
    <div className="mx-auto max-w-5xl p-6">
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

      <main className="grid gap-4">
        <section className="rounded-2xl border p-4 shadow-sm">
          <h2 className="text-lg font-medium mb-2">Status</h2>
          <ul className="text-sm list-disc pl-5 space-y-1">
            <li>Feature flag: <code>OPS_DASHBOARD_ENABLED=1</code></li>
            <li>Auth: Cookie-based session (<code>amr_ops</code>)</li>
          </ul>
        </section>

        <section className="rounded-2xl border p-4 shadow-sm">
          <h2 className="text-lg font-medium mb-2">Next up</h2>
          <ul className="text-sm list-disc pl-5 space-y-1">
            <li>Availability view (read-only)</li>
            <li>Health endpoint <code>/api/ops-admin/health</code></li>
          </ul>
        </section>
      </main>
    </div>
  );
}
