export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import OpsCreateBookingForm from "@/components/ops/ops-create-booking-form";
import { createOpsBookingAction } from "./actions";

/** Get YYYY-MM-DD of "today" in the Europe/Lisbon timezone for <input type="date" min="..."> */
function lisbonTodayYmd(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  // en-CA yields YYYY-MM-DD parts already; we reconstruct for clarity.
  return `${y}-${m}-${d}`;
}

export default async function OpsPage() {
  // 1) Fetch a tiny list of machines for the selector.
  const machines = await db.machine.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // 2) Compute Lisbon "today" once on the server; prevents client TZ drift.
  const minYmd = lisbonTodayYmd();

  // 3) Render the ops form with inline result rendering (no redirects).
  return (
    <section className="container mx-auto max-w-3xl py-10">
      <h1 className="mb-6 text-2xl font-semibold mx-10">
        CREATE BOOKING (OPS)
      </h1>
      <p className="mb-8 text-sm text-gray-600 mx-10">
        Choose a machine, pick a date range, and confirm with the ops passcode.
      </p>
      <OpsCreateBookingForm
        machines={machines}
        minYmd={minYmd}
        serverAction={createOpsBookingAction}
      />
    </section>
  );
}
