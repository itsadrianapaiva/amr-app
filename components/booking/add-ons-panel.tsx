import { Checkbox } from "@/components/ui/checkbox";
import AddOnRow from '@/components/booking/add-on-row';

type AddOnsPanelProps = {
  deliverySelected: boolean;
  pickupSelected: boolean;
  insuranceSelected: boolean;
  operatorSelected: boolean;

  onToggleDelivery: (v: boolean) => void;
  onTogglePickup: (v: boolean) => void;
  onToggleInsurance: (v: boolean) => void;
  onToggleOperator: (v: boolean) => void;

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
  operatorSelected,
  onToggleDelivery,
  onTogglePickup,
  onToggleInsurance,
  onToggleOperator,
  minDays,
}: AddOnsPanelProps) {
  return (
    <div className="mt-6 space-y-4">
      <AddOnRow
        id="delivery"
        title="Delivery"
        description="Save time - we will bring the machine to your site."
        checked={deliverySelected}
        onToggle={onToggleDelivery}
      />

      <AddOnRow
        id="pickup"
        title="Pickup"
        description="We collect it when you are done - no hassle."
        checked={pickupSelected}
        onToggle={onTogglePickup}
      />

      <AddOnRow
        id="insurance"
        title="Insurance"
        description="Covers accidental damage. Without insurance, you are responsible for repair costs."
        checked={insuranceSelected}
        onToggle={onToggleInsurance}
        badge="Recommended"
      />

      <AddOnRow
        id="operator"
        title="Driver / Operator"
        description="Certified operator to run the machine safely - charged per day."
        checked={operatorSelected}
        onToggle={onToggleOperator}
      />

      <p className="text-xs text-muted-foreground">
        Minimum rental: {minDays} {minDays > 1 ? "days" : "day"}.
      </p>
    </div>
  );
}