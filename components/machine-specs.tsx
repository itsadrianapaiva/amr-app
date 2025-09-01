import { Weight, Euro, Truck, ShieldCheck, CalendarDays } from "lucide-react";
import { formatCurrency, moneyDisplay } from "@/lib/utils";
import type { Machine } from "@prisma/client";
import { MACHINE_SPECS_COPY } from "@/lib/content/machine-detail";

interface MachineSpecsProps {
  machine: Pick<
    Machine,
    | "dailyRate"
    | "weight"
    | "deposit"
    | "deliveryCharge"
    | "pickupCharge"
    | "minDays"
  >;
}

export function MachineSpecs({ machine }: MachineSpecsProps) {
  // Pre-format core values using the shared helpers + content formatters
  const dailyRateText = formatCurrency(Number(machine.dailyRate));
  const minRentalText = MACHINE_SPECS_COPY.formatMinimumRental(machine.minDays);
  const weightText = MACHINE_SPECS_COPY.formatWeight(machine.weight);

  // Use moneyDisplay so 0 => "Included", null => "Not available", >0 => "€X"
  const depositDisplay = moneyDisplay(machine.deposit);
  const deliveryDisplay = moneyDisplay(machine.deliveryCharge);
  const pickupDisplay = moneyDisplay(machine.pickupCharge);

  const specs = [
    {
      icon: <Euro className="h-7 w-7 text-primary" />,
      label: MACHINE_SPECS_COPY.labels.dailyRate,
      value: dailyRateText,
    },
    {
      icon: <CalendarDays className="h-7 w-7 text-primary" />,
      label: MACHINE_SPECS_COPY.labels.minimumRental,
      value: minRentalText,
    },
    {
      icon: <Weight className="h-7 w-7 text-primary" />,
      label: MACHINE_SPECS_COPY.labels.weight,
      value: weightText,
    },
    {
      icon: <ShieldCheck className="h-7 w-7 text-primary" />,
      label: MACHINE_SPECS_COPY.labels.deposit,
      // "Included" | "Not available" | "€X"
      value: depositDisplay,
    },
    {
      icon: <Truck className="h-7 w-7 text-primary" />,
      label: MACHINE_SPECS_COPY.labels.deliveryCharge,
      value: deliveryDisplay,
    },
    {
      icon: <Truck className="h-7 w-7 text-primary" />,
      label: MACHINE_SPECS_COPY.labels.pickupCharge,
      value: pickupDisplay,
    },
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-4 border-y border-border/40 py-6">
      {specs.map((spec) => (
        <div key={spec.label} className="flex items-center gap-3">
          {spec.icon}
          <div>
            <p className="font-semibold">{spec.value}</p>
            <p className="text-sm text-muted-foreground">{spec.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
