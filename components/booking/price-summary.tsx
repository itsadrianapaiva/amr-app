import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { computeTotals } from "@/lib/pricing";

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
  const breakdown = computeTotals({
    rentalDays,
    dailyRate,
    deliverySelected,
    pickupSelected,
    insuranceSelected,
    deliveryCharge,
    pickupCharge,
    insuranceCharge,
  });

  return (
    <Card className="bg-muted/50 p-4">
      <h3 className="font-semibold">Price Summary</h3>
      <div className="mt-2 space-y-1 text-sm">
        <p>
          Subtotal ({breakdown.rentalDays} days):{" "}
          {formatCurrency(breakdown.subtotal)}
        </p>

        {deliverySelected && (
          <p>Delivery: {formatCurrency(breakdown.delivery)}</p>
        )}
        {pickupSelected && <p>Pickup: {formatCurrency(breakdown.pickup)}</p>}

        {insuranceSelected &&
          (insuranceCharge != null ? (
            <p>Insurance: {formatCurrency(breakdown.insurance)}</p>
          ) : (
            <p>Insurance: TBD</p>
          ))}

        <p className="font-bold">Total: {formatCurrency(breakdown.total)}</p>
        <p className="text-muted-foreground">
          Deposit due today: {formatCurrency(deposit)}
        </p>
      </div>
    </Card>
  );
}
