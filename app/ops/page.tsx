import { getMachines } from "@/lib/data";
import OpsCreateBookingForm from "@/components/ops/ops-create-booking-form";
import { getDisabledRangesByMachine } from "@/lib/availability.server";
import type { MachineOption } from "@/lib/ops/use-ops-booking-form";

// This page depends on live DB data (bookings), so keep it dynamic.
export const dynamic = "force-dynamic";

// Format a Date → 'YYYY-MM-DD' (ISO-8601 date only).
function toYmd(d: Date) {
  // Using UTC slice keeps it stable across environments for all-day ranges.
  return d.toISOString().slice(0, 10);
}

export default async function OpsPage() {
  // 1) Fetch machines for the select (PRIMARY only, addons excluded)
  const allMachines = await getMachines();
  const machines = allMachines.map((m) => ({ id: m.id, name: m.name }));

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
        machineOptions={machines as MachineOption[]}
        minYmd={today}
        disabledByMachine={disabledByMachine}
      />
    </section>
  );
}
