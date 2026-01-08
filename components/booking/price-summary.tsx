import { cn, formatCurrency } from "@/lib/utils";
import { computeTotalsFromItems, type PricingContextInput, type PricingItemInput } from "@/lib/pricing";
import { Card, CardContent } from "@/components/ui/card";
import PriceRow from "@/components/booking/price-row";
import CheckoutTrustRow from "@/components/trust/checkout-trust-row";

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

  // Charges (euros)
  deliveryCharge?: number | null;
  pickupCharge?: number | null;
  insuranceCharge?: number | null;
  operatorCharge?: number | null; // per day operator fee

  // Discount
  discountPercentage?: number; // 0-100

  // Deposit (shown separately; not included in the computeTotals total)
  deposit: number;

  // Equipment addons (Slice 6)
  equipmentAddons?: Array<{
    name: string;
    unitPrice: number;
    quantity: number;
  }>;

  className?: string;
};

/**
 * Presentational summary of pricing.
 * Delegates all *net* math to computeTotalsFromItems (ex-VAT).
 * Locally computes VAT (PT 23%) in integer cents to guarantee Stripe parity.
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
  discountPercentage = 0,
  deposit,
  equipmentAddons = [],
  className,
}: PriceSummaryProps) {
  // Build items array: primary machine + equipment addons
  const items: PricingItemInput[] = [
    {
      quantity: 1,
      chargeModel: "PER_BOOKING",
      timeUnit: "DAY",
      unitPrice: dailyRate,
    },
  ];

  // Add equipment items
  for (const equip of equipmentAddons ?? []) {
    items.push({
      quantity: equip.quantity,
      chargeModel: "PER_UNIT",
      timeUnit: "DAY",
      unitPrice: equip.unitPrice,
    });
  }

  // Build pricing context
  const context: PricingContextInput = {
    rentalDays,
    deliverySelected,
    pickupSelected,
    insuranceSelected,
    operatorSelected,
    deliveryCharge,
    pickupCharge,
    insuranceCharge,
    operatorCharge,
    discountPercentage,
  };

  // Net (ex-VAT) breakdown from central pricing utility
  const breakdown = computeTotalsFromItems(context, items);

  // --- VAT math (PT standard 23%) ------------------------------------------
  // Use integer cents to avoid floating rounding drift.
  const VAT_RATE = 0.23; // TODO: move to a shared constant (e.g. lib/tax.ts) if needed.
  const netCents = Math.round(breakdown.total * 100);
  const vatCents = Math.round(netCents * VAT_RATE);
  const grossCents = netCents + vatCents;

  const net = netCents / 100;
  const vat = vatCents / 100;
  const gross = grossCents / 100;
  // -------------------------------------------------------------------------

  if (rentalDays <= 0) return null;

  return (
    <Card className={cn(className)}>
      <CardContent className="px-4 md:p-6">
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

          {/* Equipment addon line items */}
          {equipmentAddons && equipmentAddons.length > 0 && (
            <>
              {equipmentAddons.map((equip, idx) => {
                const lineTotal = equip.unitPrice * equip.quantity * rentalDays;
                return (
                  <PriceRow
                    key={idx}
                    label={`${equip.name} (${equip.quantity} × ${rentalDays} days)`}
                  >
                    {formatCurrency(lineTotal)}
                  </PriceRow>
                );
              })}
            </>
          )}

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

          {/* Discount row */}
          {breakdown.discount > 0 && (
            <PriceRow label={`Discount (${discountPercentage}%)`}>
              <span className="text-green-600">
                -{formatCurrency(breakdown.discount)}
              </span>
            </PriceRow>
          )}

          {/* Subtotal (ex VAT) */}
          <div className="mt-3 border-t pt-3 text-sm">
            <PriceRow label="Subtotal (ex VAT)">{formatCurrency(net)}</PriceRow>
            <PriceRow label="VAT (23%)">{formatCurrency(vat)}</PriceRow>
          </div>

          {/* Total (incl VAT) */}
          <div className="mt-2 text-sm font-semibold">
            <PriceRow label="Total (incl VAT)">
              {formatCurrency(gross)}
            </PriceRow>
          </div>

          {/* Deposit is shown explicitly and is NOT added to the total */}
          <div className="text-sm">
            <PriceRow label="Deposit">
              {formatCurrency(deposit)}
            </PriceRow>
          </div>
        </div>

        {/* Notes */}
        <p className="mt-3 text-xs text-muted-foreground">
          VAT at 23% is included in the total above.
        </p>
        <p className="text-xs text-muted-foreground">
          The deposit is refundable and paid at initial handover (drop-off to your site or
          pickup at our warehouse).
        </p>

        {/* Checkout trust badges */}
        <CheckoutTrustRow />
      </CardContent>
    </Card>
  );
}

export default PriceSummary;
