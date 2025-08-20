import { Weight, Euro, Truck, ShieldCheck } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { Machine } from "@prisma/client";

interface MachineSpecsProps {
  machine: Pick<Machine, "dailyRate" | "weight" | "deposit" | "deliveryCharge">;
}

export function MachineSpecs({ machine }: MachineSpecsProps) {
  const specs = [
    {
      icon: <Euro className="h-7 w-7 text-amber-500" />, // Corrected icon
      label: "Daily Rate",
      value: formatCurrency(machine.dailyRate),
    },
    {
      icon: <Weight className="h-7 w-7 text-amber-500" />,
      label: "Weight",
      value: machine.weight,
    },
    {
      icon: <ShieldCheck className="h-7 w-7 text-amber-500" />,
      label: "Deposit",
      value: formatCurrency(machine.deposit),
    },
    {
      icon: <Truck className="h-7 w-7 text-amber-500" />,
      label: "Delivery Charge",
      value: formatCurrency(machine.deliveryCharge),
    },
  ];

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
