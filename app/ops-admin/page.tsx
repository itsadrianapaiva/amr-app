// app/ops-admin/page.tsx
import "server-only";
import { headers } from "next/headers";
import Link from "next/link";
import {
  verifySessionFromCookie,
  isOpsDashboardEnabled,
} from "@/lib/auth/session";
import { getAvailabilityWindow } from "@/lib/ops/availability";
import {
  addDays,
  toPt,
  todayYmdLisbon,
  fromYmdAtNoonUTC,
  clampInt,
} from "@/lib/ops/date";
import AvailabilityList from "@/components/ops/availability-list";

/**
 * Ops Admin — Availability (read-only)
 * URL params:
 *   ?from=YYYY-MM-DD&days=30&machineId=123
 */
export default async function OpsAdminPage({
  searchParams,
}: {
  searchParams?: { from?: string; days?: string; machineId?: string };
}) {
  // 1) Feature flag sanity — middleware is main guard.
  if (!isOpsDashboardEnabled()) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">Ops Admin</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Dashboard disabled.
        </p>
      </div>
    );
  }

  // 2) Session (role for greeting only).
  const cookieHeader = headers().get("cookie");
  const secret = process.env.AUTH_COOKIE_SECRET ?? "";
  const ver = await verifySessionFromCookie(cookieHeader, secret);
  const role = ver.ok ? ver.session.role : "unknown";

  // 3) Resolve window from URL params (fallback Today/+30).
  const todayYmd = todayYmdLisbon();
  const fromStr = searchParams?.from ?? todayYmd;
  const days = clampInt(searchParams?.days, 1, 90, 30);
  const fromDate = fromYmdAtNoonUTC(fromStr) ?? fromYmdAtNoonUTC(todayYmd)!;
  const toDate = addDays(fromDate, days);

  // 4) Optional machine filter (?machineId=123).
  const machineId =
    typeof searchParams?.machineId === "string" &&
    /^\d+$/.test(searchParams.machineId)
      ? Number(searchParams.machineId)
      : undefined;

  // 5) Fetch availability.
  const windowData = await getAvailabilityWindow({
    from: fromDate,
    to: toDate,
    machineId,
  });

  // 6) Preset links (bookmarkable).
  const presets = [
    { label: "Today", from: todayYmd, days: 30 },
    { label: "+7d", from: todayYmd, days: 7 },
    { label: "+30d", from: todayYmd, days: 30 },
    { label: "+60d", from: todayYmd, days: 60 },
  ];

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

      {/* Controls + Status */}
      <section className="rounded-2xl border p-4 shadow-sm mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium">Availability</h2>
            <p className="text-sm text-muted-foreground">
              Window: <code>{toPt(windowData.fromYmd)}</code> →{" "}
              <code>{toPt(windowData.toYmd)}</code>
            </p>
          </div>
          <nav className="flex gap-2">
            {presets.map((p) => {
              const q = new URLSearchParams({
                from: p.from,
                days: String(p.days),
              });
              if (machineId) q.set("machineId", String(machineId));
              return (
                <Link
                  key={p.label}
                  href={`/ops-admin?${q.toString()}`}
                  className="text-xs rounded-lg border px-2 py-1 hover:bg-muted"
                >
                  {p.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Machine filter (server-only form). Options filled from current window. */}
        <form method="GET" className="mt-3 flex gap-2">
          <input type="hidden" name="from" value={fromStr} />
          <input type="hidden" name="days" value={String(days)} />
          <label className="text-xs text-muted-foreground self-center">
            Machine
          </label>
          <select
            name="machineId"
            defaultValue={machineId ?? ""}
            className="text-xs rounded-lg border px-2 py-1"
          >
            <option value="">All machines</option>
            {windowData.machines.map((m) => (
              <option key={m.machineId} value={m.machineId}>
                {m.machineName}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="text-xs rounded-lg border px-2 py-1 hover:bg-muted"
          >
            Apply
          </button>
        </form>
      </section>

      {/* Availability list */}
      <section className="rounded-2xl border p-4 shadow-sm">
        <AvailabilityList machines={windowData.machines} />
      </section>
    </div>
  );
}
