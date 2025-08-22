import { Weight, Euro, Truck, ShieldCheck, CalendarDays } from "lucide-react";
import { formatCurrency, moneyDisplay } from "@/lib/utils";
import type { Machine } from "@prisma/client";

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
  const specs = [
    {
      icon: <Euro className="h-7 w-7 text-primary" />,
      label: "Daily Rate",
      // dailyRate is required — still format defensively
      value: formatCurrency(Number(machine.dailyRate)),
    },
    {
      icon: <CalendarDays className="h-7 w-7 text-primary" />,
      label: "Minimum Rental",
      value: `${machine.minDays} ${machine.minDays > 1 ? "days" : "day"}`,
    },
    {
      icon: <Weight className="h-7 w-7 text-primary" />,
      label: "Weight",
      value: String(machine.weight),
    },
    {
      icon: <ShieldCheck className="h-7 w-7 text-primary" />,
      label: "Deposit",
      value: formatCurrency(Number(machine.deposit)),
    },
    {
      icon: <Truck className="h-7 w-7 text-primary" />,
      label: "Delivery Charge",
      value: moneyDisplay(machine.deliveryCharge), // "Included" | currency | "Not available"
    },
    {
      icon: <Truck className="h-7 w-7 text-primary" />,
      label: "Pickup Charge",
      value: moneyDisplay(machine.pickupCharge), // "Included" | currency | "Not available"
    },
  ] as const; //treat this array as readonly to ensure type safety

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
