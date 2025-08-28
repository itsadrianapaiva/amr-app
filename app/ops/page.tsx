import { BookingStatus } from "@prisma/client";
import { db } from "@/lib/db";
import OpsCreateBookingForm from "@/components/ops/ops-create-booking-form";

type MachineOption = { id: number; name: string };

// Format a Date → 'YYYY-MM-DD' (ISO-8601 date only).
function toYmd(d: Date) {
  // Using UTC slice keeps it stable across environments for all-day ranges.
  return d.toISOString().slice(0, 10);
}

// Group confirmed bookings into disabled ranges by machine.
async function getDisabledRangesByMachine() {
  const bookings = await db.booking.findMany({
    where: { status: BookingStatus.CONFIRMED },
    select: { machineId: true, startDate: true, endDate: true },
    orderBy: { startDate: "asc" },
  });

  const map = new Map<number, Array<{ from: string; to: string }>>();
  for (const b of bookings) {
    const from = toYmd(b.startDate);
    const to = toYmd(b.endDate);
    const arr = map.get(b.machineId) ?? [];
    arr.push({ from, to });
    map.set(b.machineId, arr);
  }

  // Convert to a plain object for serialization
  return Object.fromEntries(map.entries());
}

export const dynamic = "force-dynamic"; // this page depends on live DB data

export default async function OpsPage() {
  // Machines for the select
  const machines = await db.machine.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Earliest selectable date (today by default — adjust if you use min policy)
  const today = toYmd(new Date());
  const disabledByMachine = await getDisabledRangesByMachine();

  // TEMP: cast to any so we can pass the new prop without changing component types yet.
  const OpsFormAny = OpsCreateBookingForm as any;

  return (
    <section className="container mx-auto max-w-3xl py-10">
      <h1 className="mb-6 text-2xl font-semibold mx-10">
        CREATE BOOKING (OPS)
      </h1>
      <p className="mb-8 text-sm text-gray-600 mx-10">
        Choose a machine, pick a date range, and confirm with the ops passcode.
      </p>
      <OpsFormAny
        machines={machines as MachineOption[]}
        minYmd={today}
        serverAction={async (_prev: any, formData: FormData) => {
          "use server";
          // Delegate to your existing action (kept here for illustration).
          const { createOpsBookingAction } = await import("./actions");
          return createOpsBookingAction(_prev, formData);
        }}
        disabledByMachine={disabledByMachine}
      />
    </section>
  );
}
