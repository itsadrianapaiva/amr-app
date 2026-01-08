"use client";

import { useFieldArray, Control, useWatch } from "react-hook-form";
import { BookingFormValues } from "@/lib/validation/booking";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Minus, Plus } from "lucide-react";

export type EquipmentAddon = {
  code: string;
  name: string;
  unitPrice: number;
  unitLabel: string;
};

type EquipmentAddonsPanelProps = {
  control: Control<BookingFormValues>;
  equipment: EquipmentAddon[];
};

export default function EquipmentAddonsPanel({
  control,
  equipment,
}: EquipmentAddonsPanelProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "equipmentAddons",
  });

  // Watch current selections for header display
  const selectedItems = useWatch({
    control,
    name: "equipmentAddons",
  });

  const selectedCount = selectedItems?.length ?? 0;

  // Helper to check if an equipment code is selected
  const isSelected = (code: string) =>
    fields.findIndex((f) => f.code === code) !== -1;

  // Helper to get quantity for a code
  const getQuantity = (code: string) => {
    const index = fields.findIndex((f) => f.code === code);
    return index >= 0 ? fields[index].quantity : 1;
  };

  // Handle checkbox toggle
  const handleToggle = (code: string, checked: boolean) => {
    if (checked) {
      append({ code, quantity: 1 });
    } else {
      const index = fields.findIndex((f) => f.code === code);
      if (index >= 0) remove(index);
    }
  };

  // Handle quantity change
  const handleQuantityChange = (code: string, delta: number) => {
    const index = fields.findIndex((f) => f.code === code);
    if (index >= 0) {
      const currentQty = fields[index].quantity;
      const newQty = Math.max(1, Math.min(999, currentQty + delta));
      // Update via field array (RHF manages state)
      const updatedFields = [...fields];
      updatedFields[index] = { ...updatedFields[index], quantity: newQty };
      // Remove all and re-add (simple approach for RHF field array)
      remove();
      updatedFields.forEach((f) => append(f));
    }
  };

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="equipment">
        <AccordionTrigger className="text-base font-medium">
          Extra equipment
          {selectedCount > 0 && (
            <span className="ml-2 text-sm text-gray-500">
              ({selectedCount} selected)
            </span>
          )}
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-4 pt-2">
            {equipment.map((item) => {
              const selected = isSelected(item.code);
              const quantity = getQuantity(item.code);
              const lineTotal = (quantity * item.unitPrice).toFixed(2);

              return (
                <div
                  key={item.code}
                  className="flex items-start gap-4 rounded-lg border p-4"
                >
                  <Checkbox
                    id={`equip-${item.code}`}
                    checked={selected}
                    onCheckedChange={(checked) =>
                      handleToggle(item.code, checked === true)
                    }
                  />
                  <div className="flex-1">
                    <label
                      htmlFor={`equip-${item.code}`}
                      className="font-medium cursor-pointer"
                    >
                      {item.name}
                    </label>
                    <div className="text-sm text-gray-600 mt-1">
                      €{item.unitPrice.toFixed(2)} {item.unitLabel}
                    </div>
                    {selected && (
                      <div className="flex items-center gap-3 mt-3">
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleQuantityChange(item.code, -1)}
                            disabled={quantity <= 1}
                            className="h-8 w-8 p-0"
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-12 text-center font-medium">
                            {quantity}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleQuantityChange(item.code, 1)}
                            disabled={quantity >= 999}
                            className="h-8 w-8 p-0"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="text-sm text-gray-600">
                          = €{lineTotal}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
