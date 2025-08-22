import { getMachineById } from "@/lib/data";
import { getDisabledDateRangesForMachine } from "@/lib/availability.server";
import { serializeMachine } from "@/lib/serializers";
import { notFound } from "next/navigation";
import Image from "next/image";
import { MachineSpecs } from "@/components/machine-specs";
import Pretitle from "@/components/ui/pretitle";
import { BookingForm } from "@/components/booking-form";
import type { SerializableMachine } from "@/lib/types";
import { toTitleCase } from "@/lib/utils";

export default async function MachineDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params; // Await the params promise here
  const machineId = parseInt(id, 10);
  if (isNaN(machineId)) {
    notFound();
  }

  const machine = await getMachineById(machineId);
  if (!machine) {
    notFound();
  }

  // Get merged, JSON-safe disabled ranges for this machine
  const disabledRangesJSON = await getDisabledDateRangesForMachine(machine.id);

  // Use shared serializer, then pick only what the form needs
  const s = serializeMachine(machine);
  const formMachine: Pick<
    SerializableMachine,
    | "id"
    | "dailyRate"
    | "deposit"
    | "deliveryCharge"
    | "pickupCharge"
    | "minDays"
  > = {
    id: s.id,
    dailyRate: s.dailyRate,
    deposit: s.deposit,
    deliveryCharge: s.deliveryCharge,
    pickupCharge: s.pickupCharge,
    minDays: s.minDays,
  };

  // Display strings
  const displayName = toTitleCase(machine.name);
  const displayType = machine.type ? toTitleCase(machine.type) : "";

  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto">
        <div className="grid grid-cols-1 gap-8 lg:gap-12">
          <Pretitle center text="Machine Details" />

          {/* Column 1: Image */}
          <div className="relative h-[400px] w-full overflow-hidden rounded-lg md:h-[500px]">
            <Image
              src={machine.imageUrl}
              fill
              className="object-cover"
              alt={`Image of ${displayName}`}
              unoptimized
            />
          </div>

          {/* Column 2: Details & Booking Form */}
          <div className="flex flex-col">
            <h1 className="mb-4 text-3xl font-bold md:text-4xl">
              {displayName}
            </h1>
            {displayType && (
              <p className="mb-4 text-sm text-muted-foreground">
                {displayType}
              </p>
            )}
            <p className="mb-6 text-muted-foreground">{machine.description}</p>

            <MachineSpecs machine={machine} />

            {/* Real booking form */}
            <div className="mt-8">
              <BookingForm
                machine={formMachine}
                disabledRangesJSON={disabledRangesJSON}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
