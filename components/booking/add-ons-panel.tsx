import { Checkbox } from "@/components/ui/checkbox";

type AddOnsPanelProps = {
  deliverySelected: boolean;
  pickupSelected: boolean;
  insuranceSelected: boolean;
  onToggleDelivery: (v: boolean) => void;
  onTogglePickup: (v: boolean) => void;
  onToggleInsurance: (v: boolean) => void;
  minDays: number;
};

/**
 * Pure presentational group of three checkboxes.
 * - No RHF imports, no business logic, no formatting.
 * - Container owns state/validation; this just renders and forwards changes.
 */
export function AddOnsPanel({
  deliverySelected,
  pickupSelected,
  insuranceSelected,
  onToggleDelivery,
  onTogglePickup,
  onToggleInsurance,
  minDays,
}: AddOnsPanelProps) {
  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <p className="font-medium">Delivery</p>
          <p className="text-sm text-muted-foreground">
            Have us deliver the machine.
          </p>
        </div>
        <Checkbox
          checked={deliverySelected}
          onCheckedChange={(v) => onToggleDelivery(Boolean(v))}
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <p className="font-medium">Pickup</p>
          <p className="text-sm text-muted-foreground">
            We collect the machine at the end.
          </p>
        </div>
        <Checkbox
          checked={pickupSelected}
          onCheckedChange={(v) => onTogglePickup(Boolean(v))}
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <p className="font-medium">Insurance</p>
          <p className="text-sm text-muted-foreground">
            Optional damage coverage.
          </p>
        </div>
        <Checkbox
          checked={insuranceSelected}
          onCheckedChange={(v) => onToggleInsurance(Boolean(v))}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Minimum rental: {minDays} {minDays > 1 ? "days" : "day"}.
      </p>
    </div>
  );
}
