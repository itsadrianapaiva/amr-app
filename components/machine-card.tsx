import Image from "next/image";
import Link from "next/link";
import type { Machine } from "@prisma/client";
import { ArrowRight } from "lucide-react"; // Using icons from our shadcn/ui setup

interface MachineCardProps {
  machine: Machine;
}

export function MachineCard({ machine }: MachineCardProps) {
  const formattedRate = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
  }).format(Number(machine.dailyRate));

  return (
    <div className="group relative h-[492px] w-full overflow-hidden">
      {/* Background Image: Fills the container and zooms slightly on hover */}
      <Image
        src={machine.imageUrl}
        fill
        className="object-cover transition-transform duration-500 group-hover:scale-105"
        alt={`Image of ${machine.name}`}
        unoptimized
      />

      {/* Overlay Panel: Hidden by default, slides up on hover */}
      <div className="absolute bottom-0 flex h-24 w-full items-center justify-between bg-black/60 text-white backdrop-blur-md transition-all duration-500 translate-y-24 group-hover:translate-y-0">
        <div className="pl-8">
          <h4 className="font-semibold uppercase tracking-wider">
            {machine.name}
          </h4>
          <p className="text-sm">{formattedRate} / day</p>
        </div>
        <Link
          href={`/machine/${machine.id}`}
          className="mr-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500 text-white transition-colors hover:bg-amber-600"
        >
          <ArrowRight className="h-6 w-6" />
        </Link>
      </div>
    </div>
  );
}
