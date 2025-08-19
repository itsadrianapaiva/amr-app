import { getMachines } from "@/lib/data";
import { MachineCard } from "@/components/machine-card";

export default async function Home() {
  const machines = await getMachines();

  return (
    <main>
      {/* Header Section - Inspired by your old project */}
      <section className="container mx-auto py-16 text-center xl:py-24">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-500">
          Our Inventory
        </h2>
        <h1 className="my-3 text-3xl font-bold tracking-tight md:text-4xl">
          Machinery for Rent
        </h1>
        <p className="mx-auto max-w-xl text-muted-foreground">
          Explore our selections of robust and reliable machines, ready for any
          challenge on your job site.
        </p>
      </section>

      {/* Machine Grid Section */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        {machines.map((machine) => (
          <MachineCard key={machine.id} machine={machine} />
        ))}
      </section>
    </main>
  );
}
