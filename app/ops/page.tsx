import { db } from "@/lib/db";
import OpsCreateBookingForm from "@/components/ops/ops-create-booking-form";
import { getDisabledRangesByMachine } from "@/lib/availability.server";

// --- Type-only wiring to match ./actions exactly (no runtime import)
type CreateOpsBookingAction = typeof import("./actions")["createOpsBookingAction"];
type OpsPrevState = Parameters<CreateOpsBookingAction>[0];

// This page depends on live DB data (bookings), so keep it dynamic.
export const dynamic = "force-dynamic";

type MachineOption = { id: number; name: string };

// Format a Date → 'YYYY-MM-DD' (ISO-8601 date only).
function toYmd(d: Date) {
  // Using UTC slice keeps it stable across environments for all-day ranges.
  return d.toISOString().slice(0, 10);
}

export default async function OpsPage() {
  // 1) Fetch machines for the select
  const machines = await db.machine.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // 2) Min selectable date (today)
  const today = toYmd(new Date());

  // 3) Disabled ranges per machine (CONFIRMED bookings, merged/normalized)
  const byMachineNum = await getDisabledRangesByMachine();
  // Convert map keys from number → string to match the form’s prop type
  const disabledByMachine = Object.fromEntries(
    Object.entries(byMachineNum).map(([k, v]) => [String(k), v])
  );

  return (
    <section className="container mx-auto max-w-3xl py-16">
      <h1 className="mb-6 text-2xl font-semibold mx-10">
        CREATE BOOKING (OPS)
      </h1>
      <p className="mb-8 text-sm text-gray-600 mx-10">
        Choose a machine, pick a date range, and confirm with the ops passcode.
      </p>
      <OpsCreateBookingForm
        machines={machines as MachineOption[]}
        minYmd={today}
        serverAction={async (_prev: OpsPrevState, formData: FormData) => {
          "use server";
          const { createOpsBookingAction } = await import("./actions");
          return createOpsBookingAction(_prev, formData);
        }}
        disabledByMachine={disabledByMachine}
      />
    </section>
  );
}
