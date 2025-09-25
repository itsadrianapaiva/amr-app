import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { SerializableMachine } from "@/lib/types";
import { cn, formatCurrency, moneyDisplay, toTitleCase } from "@/lib/utils";
import { MACHINE_CARD_COPY } from "@/lib/content/machines";
import { resolveMachineImage } from "@/lib/content/images";

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

interface MachineCardProps {
  machine: SerializableMachine;
  /** Hint to load this card's image sooner (used for first row only). */
  eager?: boolean;
}

export function MachineCard({ machine, eager = false }: MachineCardProps) {
  // Derived display values
  const displayName = toTitleCase(machine.name);

  // Support both fields during the migration (category preferred, fallback to type)
  const categoryOrType = getCategoryOrType(machine);
  const displayType = MACHINE_CARD_COPY.displayType(categoryOrType);

  const dailyRateFormatted = formatCurrency(machine.dailyRate);
  const pricePerDay = MACHINE_CARD_COPY.formatPricePerDay(dailyRateFormatted);

  const minDays = typeof machine.minDays === "number" ? machine.minDays : 1;
  const minDaysText = MACHINE_CARD_COPY.formatMinDays(minDays);

  // Use moneyDisplay so 0 => "Included", null => "Not available"
  const depositVal = moneyDisplay(machine.deposit);
  const depositText =
    depositVal === "Included"
      ? "Deposit included"
      : depositVal === "Not available"
        ? "Deposit N/A"
        : MACHINE_CARD_COPY.formatDeposit(depositVal); // "Deposit €X"

  const showDelivery = machine.deliveryCharge != null;
  const showPickup = machine.pickupCharge != null;

  const specs: string[] = [depositText];
  if (showDelivery) specs.push(MACHINE_CARD_COPY.labels.deliveryAvailable);
  if (showPickup) specs.push(MACHINE_CARD_COPY.labels.pickupAvailable);
  const specsLine = specs.join(" • ");

  // Resolve local/static or remote image (remote is guarded)
  const img = resolveMachineImage({
    type: categoryOrType,
    name: machine.name ?? "",
    dbUrl: null, // explicitly ignore external URLs on cards
  });

  const srcToUse = img.src as StaticImageData | string;
  const altToUse = img.alt;

  // If we have a static import, use a blur placeholder for nicer perceived loading
  const isStatic =
    typeof srcToUse === "object" &&
    srcToUse !== null &&
    "src" in (srcToUse as any);

  return (
    <div className="group relative h-[492px] w-full overflow-hidden">
      {/* Optional pre-badge reinforcing USP */}
      {MACHINE_CARD_COPY.preBadge && (
        <span
          className={cn(
            "absolute left-3 top-3 z-20 rounded-full px-2.5 py-1 text-xs font-medium shadow",
            "bg-secondary text-primary-foreground"
          )}
        >
          {MACHINE_CARD_COPY.preBadge}
        </span>
      )}

      {/* Background Image */}
      <Image
        src={srcToUse}
        alt={altToUse}
        fill
        /* 1 / 2 / 4 columns on base / md / xl */
        sizes="(min-width:1280px) 25vw, (min-width:768px) 50vw, 100vw"
        /* Keep first row eager for UX, but don't strong-arm the network into a preload */
        loading={eager ? "eager" : "lazy"}
        placeholder={isStatic ? "blur" : "empty"}
        quality={78}
        className="object-cover transition-transform duration-500 group-hover:scale-105"
      />

      {/* Overlay */}
      <div
        className={cn(
          "absolute bottom-0 w-full backdrop-blur-md transition-all duration-500",
          "bg-surface/80 text-foreground",
          "translate-y-0 md:translate-y-40 md:group-hover:translate-y-0"
        )}
      >
        <div className="grid gap-1.5 px-5 py-4">
          {/* Top row: name + CTA */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold tracking-tight">{displayName}</h3>
              <p
                className="max-w-[14rem] truncate text-xs uppercase tracking-wider text-muted-foreground"
                title={displayType}
              >
                {displayType}
              </p>
            </div>

            <Link
              href={`/machine/${machine.id}`}
              className={cn(
                "ml-4 flex h-12 w-12 items-center justify-center rounded-full",
                "bg-primary text-primary-foreground hover:bg-primary/80"
              )}
              aria-label={`View ${displayName}`}
            >
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>

          {/* Price + min days */}
          <p className="text-sm">
            {pricePerDay}{" "}
            <span className="text-muted-foreground">· {minDaysText}</span>
          </p>

          {/* Compact specs line */}
          <p className="text-xs text-muted-foreground">{specsLine}</p>
        </div>
      </div>
    </div>
  );
}
