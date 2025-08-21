import { getMachineById } from "@/lib/data";
import { getDisabledDateRangesForMachine } from "@/lib/availability.server";
import { notFound } from "next/navigation";
import Image from "next/image";
import { MachineSpecs } from "@/components/machine-specs";
import Pretitle from "@/components/ui/pretitle";
import { BookingForm } from "@/components/booking-form";
import type { SerializableMachine } from "@/lib/types";

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

  // Adapter: convert Prisma Decimals to strings expected by SerializedMachine
  const formMachine: Pick<
    SerializableMachine,
    "id" | "dailyRate" | "deposit" | "deliveryCharge"
  > = {
    id: machine.id,
    dailyRate: machine.dailyRate.toString(),
    deposit: machine.deposit.toString(),
    deliveryCharge: machine.deliveryCharge.toString(),
  };

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
              alt={`Image of ${machine.name}`}
              unoptimized
            />
          </div>

          {/* Column 2: Details & Booking Form */}
          <div className="flex flex-col">
            <h1 className="mb-4 text-3xl font-bold md:text-4xl">
              {machine.name}
            </h1>
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
