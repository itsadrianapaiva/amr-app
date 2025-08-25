import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * PriceRow
 * Small, presentational row for label + value in pricing cards.
 * Keeps markup DRY and consistent across pricing-related components.
 */
type PriceRowProps = {
  label: string;
  children: React.ReactNode; // usually a formatted currency or number
  className?: string;
};

function PriceRow({ label, children, className }: PriceRowProps) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <span>{label}</span>
      <span className="tabular-nums">{children}</span>
    </div>
  );
}

export default React.memo(PriceRow);
