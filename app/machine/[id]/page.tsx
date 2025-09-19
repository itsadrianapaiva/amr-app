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
import { MACHINE_DETAIL_COPY } from "@/lib/content/machine-detail";
import { MACHINE_CARD_COPY } from "@/lib/content/machines";
import { resolveMachineImage } from "@/lib/content/images";
import { buildMachineDescription } from "@/lib/content/machine-description";
import { shouldHideDetailByName } from "@/lib/visibility";
import ProductJsonLd from "@/components/seo/product-jsonld";

/** Safe reader for either 'category' (new) or 'type' (legacy) without using 'any'. */
function getCategoryOrType(m: unknown): string {
  if (m && typeof m === "object") {
    const r = m as Record<string, unknown>;
    const cat =
      typeof r["category"] === "string" ? (r["category"] as string) : undefined;
    const typ =
      typeof r["type"] === "string" ? (r["type"] as string) : undefined;
    return cat ?? typ ?? "";
  }
  return "";
}

type PageParams = { id: string };

export default async function MachineDetailPage({
  params,
}: {
  /** Match Next.js PageProps: params is a Promise here. */
  params: Promise<PageParams>;
}) {
  // Normalize params per PageProps shape
  const { id } = await params;

  const machineId = parseInt(id, 10);
  if (isNaN(machineId)) {
    notFound();
  }

  const machine = await getMachineById(machineId);
  if (!machine) {
    notFound();
  }

  //  Optional: hide internal/test items when HIDE_INTERNAL_DETAIL=1 (e.g., on prod)
  if (shouldHideDetailByName(machine.name)) {
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

  // Prefer new 'category', fall back to legacy 'type' during migration (no 'any')
  const categoryOrType = getCategoryOrType(machine);
  const displayType = MACHINE_CARD_COPY.displayType(categoryOrType);

  // Centralized image resolution
  const img = resolveMachineImage({
    type: categoryOrType,
    name: String(machine.name ?? ""),
    dbUrl: null, // avoid external hosts in Next/Image on detail page
  });

  // Normalize Next/Image StaticImageData to string for JSON-LD
  const imageSrc =
    typeof img.src === "string" ? img.src : (img.src as { src: string }).src;

  const jsonLd = (
    <ProductJsonLd
      id={machine.id}
      name={displayName}
      description={buildMachineDescription(machine)}
      image={imageSrc}
      dailyRate={s.dailyRate}
    />
  );

  return (
    <>
      {jsonLd}
      <section className="px-4 py-16 md:py-24 md:px-8 lg:px-12">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 gap-8 lg:gap-12">
            <Pretitle center text={MACHINE_DETAIL_COPY.pretitle} />

            {/* Column 1: Image */}
            <div className="relative h-[400px] w-full overflow-hidden rounded-lg md:h-[500px]">
              <Image
                src={img.src}
                alt={img.alt}
                fill
                /* Use max-width logic: on small screens take full viewport width, otherwise cap around our content column width */
                sizes="(max-width: 1024px) 100vw, 960px"
                /* Detail pages land with this hero-like image above the fold; make it LCP-friendly */
                priority
                fetchPriority="high"
                className="object-cover"
              />
            </div>

            {/* Column 2: Details & Booking Form */}
            <div className="flex flex-col">
              <h1 className="mb-4 text-2xl font-bold md:text-3xl uppercase">
                {displayName}
              </h1>
              {displayType && (
                <p className="mb-4 text-sm text-muted-foreground">
                  {displayType}
                </p>
              )}
              <p className="mb-6 text-muted-foreground">
                {buildMachineDescription(machine)}
              </p>

              <MachineSpecs machine={machine} />

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
    </>
  );
}
