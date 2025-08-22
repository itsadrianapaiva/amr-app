import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

/**
 * Pure presentational component. No business logic, no RHF.
 * Keeps BookingForm lean and testable.
 */
type PriceSummaryProps = {
  rentalDays: number;
  dailyRate: number;
  deposit: number;
  // Optional add-ons. Defaults keep API ergonomic
  deliverySelected?: boolean;
  pickupSelected?: boolean;
  insuranceSelected?: boolean;
  deliveryCharge?: number | null;
  pickupCharge?: number | null;
  insuranceCharge?: number | null;
};

export function PriceSummary({
  rentalDays,
  dailyRate,
  deposit,
  deliverySelected = false,
  pickupSelected = false,
  insuranceSelected = false,
  deliveryCharge = 0,
  pickupCharge = 0,
  insuranceCharge = null,
}: PriceSummaryProps) {
  const subtotal = rentalDays * dailyRate;
  const deliveryCost = deliverySelected ? Number(deliveryCharge ?? 0) : 0;
  const pickupCost = pickupSelected ? Number(pickupCharge ?? 0) : 0;
  const insuranceCost = insuranceSelected ? Number(insuranceCharge ?? 0) : 0;
  const total =
    subtotal +
    deliveryCost +
    pickupCost +
    (insuranceCharge != null ? insuranceCost : 0); // only adds to total when price is known

  return (
    <Card className="bg-muted/50 p-4">
      <h3 className="font-semibold">Price Summary</h3>
      <div className="mt-2 space-y-1 text-sm">
        <p>
          Subtotal ({rentalDays} days): {formatCurrency(subtotal)}
        </p>

        {deliverySelected && <p>Delivery: {formatCurrency(deliveryCost)}</p>}
        {pickupSelected && <p>Pickup: {formatCurrency(pickupCost)}</p>}

        {insuranceSelected &&
          (insuranceCharge != null ? (
            <p>Insurance: {formatCurrency(insuranceCost)}</p>
          ) : (
            <p>Insurance: TBD</p>
          ))}
        <p className="font-bold">Total: {formatCurrency(total)}</p>
        <p className="text-muted-foreground">
          Deposit due today: {formatCurrency(deposit)}
        </p>
      </div>
    </Card>
  );
}
