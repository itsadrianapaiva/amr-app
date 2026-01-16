import { getMachineById } from "@/lib/data";
import { getDisabledDateRangesForMachine } from "@/lib/availability.server";
import { serializeMachine } from "@/lib/serializers";
import { notFound } from "next/navigation";
import Image, { type StaticImageData } from "next/image";
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
import HowToBook from "@/components/how-to-book";
import MachineMetaViewContent from "@/components/analytics/machine-meta-viewcontent";
import { db } from "@/lib/db";

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

  // Fetch equipment addon machines for the booking form
  const equipmentAddons = await db.machine.findMany({
    where: { itemType: "ADDON", addonGroup: "EQUIPMENT" },
    select: { code: true, name: true, dailyRate: true },
    orderBy: { name: "asc" },
  });

  // Serialize equipment for client
  const equipmentList = equipmentAddons.map((e) => ({
    code: e.code,
    name: e.name,
    unitPrice: Number(e.dailyRate),
    unitLabel: "per day",
  }));

  // Use shared serializer, then pick only what the form needs
  const s = serializeMachine(machine);
  const formMachine: Pick<
    SerializableMachine,
    | "id"
    | "name"
    | "dailyRate"
    | "deposit"
    | "deliveryCharge"
    | "pickupCharge"
    | "minDays"
  > = {
    id: s.id,
    name: s.name,
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
    code: machine.code,
    type: categoryOrType,
    name: String(machine.name ?? ""),
    dbUrl: null, // avoid external hosts in Next/Image on detail page
  });

  // Detect StaticImageData to enable blur placeholder & intrinsic sizing hints
  const isStatic =
    typeof img.src === "object" &&
    img.src !== null &&
    "src" in (img.src as StaticImageData);

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
      {/* Meta Pixel ViewContent tracking */}
      <MachineMetaViewContent
        machineId={machine.id}
        machineName={displayName}
        category={categoryOrType}
        dailyRate={Number(s.dailyRate)}
      />
      <section className="px-4 py-8 md:py-10 md:px-8 lg:px-12">
        <div className="container mx-auto">
          {/* Full-width Pretitle + Intro */}
          <div className="mb-8 md:mb-16">
            <Pretitle center text={MACHINE_DETAIL_COPY.pretitle} />
            <p className="mt-4 text-muted-foreground mx-auto text-center max-w-2xl">
              In this page you have all you need to verify availability, add
              extras and check live prices. See below for more details.
            </p>
          </div>

          {/* Hero Grid: 2-column on md+ (Image left, Content right) */}
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:items-start lg:gap-12 mb-8">
            {/* Image Column - order-1 on mobile (after pretitle), order-1 on md+ (left side) */}
            <div className="order-1 md:order-1 flex justify-center">
              <div className="relative aspect-square w-full  max-w-md overflow-hidden rounded-lg">
                <Image
                  src={img.src}
                  alt={img.alt}
                  fill
                  sizes="(min-width: 768px) 50vw, 100vw"
                  priority={false}
                  quality={72}
                  placeholder={isStatic ? "blur" : "empty"}
                  decoding="async"
                  className="object-contain"
                />
              </div>
            </div>

            {/* Content Column - order-2 on mobile (after image), order-2 on md+ (right side) */}
            <div className="order-2 md:order-2 flex flex-col">
              <h1 className="mb-4 text-2xl font-bold md:text-3xl uppercase">
                {displayName}
              </h1>
              {displayType && (
                <p className="mb-4 text-sm text-muted-foreground">
                  {displayType}
                </p>
              )}
              <p className="mb-12 text-muted-foreground max-w-xl">
                {buildMachineDescription(machine)}
              </p>

              <MachineSpecs machine={machine} />
            </div>
          </div>

          {/* Full-width Booking Form */}
          <div className="mt-8 lg:mx-28">
            <BookingForm
              machine={formMachine}
              disabledRangesJSON={disabledRangesJSON}
              equipment={equipmentList}
            />
          </div>
        </div>
      </section>
      {/* AMR: HowToBook section start */}
      <HowToBook />
    </>
  );
}
