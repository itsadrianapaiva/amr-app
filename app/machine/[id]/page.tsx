import { getMachineById } from "@/lib/data";
import { notFound } from "next/navigation";
import Image from "next/image";
import { MachineSpecs } from "@/components/machine-specs";

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

  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
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
            <p className="mb-6 text-muted-foreground">
              {machine.description}
            </p>

            <MachineSpecs machine={machine} />

            {/* Booking Form Placeholder */}
            <div className="mt-8 rounded-lg border border-border/40 bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-2xl font-semibold">Book This Machine</h2>
              <p className="text-muted-foreground">
                The interactive booking form will be implemented here.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
