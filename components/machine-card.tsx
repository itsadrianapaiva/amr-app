// File: components/machine-card.tsx
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { SerializableMachine } from "@/lib/types";
import { cn, formatCurrency, moneyDisplay, toTitleCase } from "@/lib/utils";
import { MACHINE_CARD_COPY } from "@/lib/content/machines";

interface MachineCardProps {
  machine: SerializableMachine;
}

export function MachineCard({ machine }: MachineCardProps) {
  // Derived display values
  const displayName = toTitleCase(machine.name);
  const displayType = MACHINE_CARD_COPY.displayType(machine.type);

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

  return (
    <div className="group relative h-[492px] w-full overflow-hidden">
      {/* Optional pre-badge reinforcing USP */}
      {MACHINE_CARD_COPY.preBadge && (
        <span
          className={cn(
            "absolute left-3 top-3 z-20 rounded-full px-2.5 py-1 text-xs font-medium shadow",
            "bg-primary text-primary-foreground"
          )}
        >
          {MACHINE_CARD_COPY.preBadge}
        </span>
      )}

      {/* Background Image */}
      <Image
        src={machine.imageUrl || "/fallback-image.jpg"}
        fill
        className="object-cover transition-transform duration-500 group-hover:scale-105"
        alt={`Image of ${displayName}`}
        unoptimized
      />

      {/* Overlay */}
      <div
        className={cn(
          "absolute bottom-0 w-full backdrop-blur-md transition-all duration-500",
          "bg-surface/80 text-foreground",
          "translate-y-0 md:translate-y-24 md:group-hover:translate-y-0"
        )}
      >
        <div className="grid gap-1.5 px-5 py-4">
          {/* Top row: name + CTA */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold tracking-tight">{displayName}</h4>
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
