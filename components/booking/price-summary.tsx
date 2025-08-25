import { cn, formatCurrency } from "@/lib/utils";
import { computeTotals, PriceInputs } from "@/lib/pricing";
import { Card, CardContent } from "@/components/ui/card";
import PriceRow from "@/components/booking/price-row";

/**
 * Pure presentational component. No business logic, no RHF.
 * Keeps BookingForm lean and testable.
 */
type PriceSummaryProps = {
  // Core pricing inputs
  rentalDays: number;
  dailyRate: number;

  // Add-on toggles. Defaults keep API ergonomic
  deliverySelected?: boolean;
  pickupSelected?: boolean;
  insuranceSelected?: boolean;
  operatorSelected?: boolean;

  //Charges (euros)
  deliveryCharge?: number | null;
  pickupCharge?: number | null;
  insuranceCharge?: number | null;
  operatorCharge?: number | null; // per day operator fee

  // Deposit (shown separately; not included in the computeTotals total)
  deposit: number;

  className?: string;
};

/**
 * Presentational summary of pricing.
 * Delegates all math to computeTotals for a single source of truth.
 * Keeps the component dumb and stable across client/server.
 */

export function PriceSummary({
  rentalDays,
  dailyRate,
  deliverySelected = true,
  pickupSelected = true,
  insuranceSelected = true,
  operatorSelected = false,
  deliveryCharge = 0,
  pickupCharge = 0,
  insuranceCharge = null,
  operatorCharge = null,
  deposit,
  className,
}: PriceSummaryProps) {
  // Shapes the inputs for computeTotals while staying compatible with older callers
  const inputs: PriceInputs = {
    rentalDays,
    dailyRate,
    deliverySelected,
    pickupSelected,
    insuranceSelected,
    deliveryCharge,
    pickupCharge,
    insuranceCharge,
    operatorSelected,
    operatorCharge,
  };

  const breakdown = computeTotals(inputs);

  return (
    <Card className={cn(className)}>
      <CardContent className="p-4 md:p-6">
        <h3 className="text-base font-semibold tracking-tight">
          Price summary
        </h3>

        <div className="mt-4 space-y-2 text-sm">
          <PriceRow
            label={`Rental (${breakdown.rentalDays} day${
              breakdown.rentalDays === 1 ? "" : "s"
            })`}
          >
            {formatCurrency(breakdown.subtotal)}
          </PriceRow>

          {deliverySelected && (
            <PriceRow label="Delivery">
              {formatCurrency(breakdown.delivery)}
            </PriceRow>
          )}

          {pickupSelected && (
            <PriceRow label="Pickup">
              {formatCurrency(breakdown.pickup)}
            </PriceRow>
          )}

          {insuranceSelected && insuranceCharge != null && (
            <PriceRow label="Insurance">
              {formatCurrency(breakdown.insurance)}
            </PriceRow>
          )}

          {operatorSelected && operatorCharge != null && (
            <PriceRow label="Driver / Operator">
              {formatCurrency(breakdown.operator)}
            </PriceRow>
          )}

          <div className="mt-3 border-t pt-3 text-sm font-semibold">
            <PriceRow label="Total">{formatCurrency(breakdown.total)}</PriceRow>
          </div>

          {/* Deposit is shown explicitly and is NOT added to the total */}
          <div className="text-sm">
            <PriceRow label="Deposit due today">
              {formatCurrency(deposit)}
            </PriceRow>
          </div>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Prices shown exclude VAT. We’ll collect invoicing details at checkout
          if you’re booking as a business.
        </p>
      </CardContent>
    </Card>
  );
}

export default PriceSummary;
