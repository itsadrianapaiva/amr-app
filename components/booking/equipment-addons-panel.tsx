"use client";

import { useState } from "react";
import { useFieldArray, Control, useWatch } from "react-hook-form";
import { BookingFormValues } from "@/lib/validation/booking";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus, ChevronDown } from "lucide-react";

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
  const [isExpanded, setIsExpanded] = useState(false);

  const { fields, append, remove, update } = useFieldArray({
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

  // Handle quantity change via +/- buttons
  const handleQuantityChange = (code: string, delta: number) => {
    const index = fields.findIndex((f) => f.code === code);
    if (index >= 0) {
      const currentQty = fields[index].quantity;
      const newQty = Math.max(1, Math.min(999, currentQty + delta));
      // Use update() instead of remove()+append() to avoid transient empty arrays
      // that cause sessionStorage draft to capture equipmentAddons: []
      update(index, { code, quantity: newQty });
    }
  };

  // Handle direct quantity input
  const handleQuantitySet = (code: string, newQuantity: number) => {
    const index = fields.findIndex((f) => f.code === code);
    if (index >= 0) {
      // Validate and clamp input to [1, 999]
      if (isNaN(newQuantity)) return;
      const clampedQty = Math.max(1, Math.min(999, newQuantity));
      // Use update() to preserve RHF field IDs and avoid transient empty arrays
      update(index, { code, quantity: clampedQty });
    }
  };

  return (
    <Card>
      <CardHeader
        className={`cursor-pointer transition-colors ${isExpanded ? "border-b" : ""}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <CardTitle className="text-base flex items-center gap-2">
          Extra Equipment
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
          {selectedCount > 0 && (
            <span className="ml-auto text-sm font-normal text-muted-foreground">
              ({selectedCount} selected)
            </span>
          )}
        </CardTitle>
      </CardHeader>
      {isExpanded && (
        <CardContent>
          <div className="space-y-4">
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
                        <Input
                          type="number"
                          min={1}
                          max={999}
                          value={quantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val) && val >= 1 && val <= 999) {
                              handleQuantitySet(item.code, val);
                            }
                          }}
                          className="h-8 w-20 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
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
        </CardContent>
      )}
    </Card>
  );
}
