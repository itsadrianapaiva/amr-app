import { Lock, FileText, BadgeCheck } from "lucide-react";
import { TRUST_PARTNERS } from "@/lib/content/trust-partners";
import { cn } from "@/lib/utils";

/**
 * Map icon names to Lucide components for checkout trust badges.
 */
const ICON_MAP = {
  lock: Lock,
  document: FileText,
  "badge-check": BadgeCheck,
} as const;

type CheckoutTrustRowProps = {
  className?: string;
};

/**
 * CheckoutTrustRow
 * Displays compact trust badges at the bottom of the PriceSummary card.
 * Shows only partners with showOnCheckout === true.
 */
export default function CheckoutTrustRow({
  className,
}: CheckoutTrustRowProps = {}) {
  const checkoutPartners = TRUST_PARTNERS.filter((p) => p.showOnCheckout);

  if (checkoutPartners.length === 0) return null;

  return (
    <div
      className={cn(
        "mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3",
        className
      )}
      aria-label="Payment and invoicing security information"
    >
      {checkoutPartners.map((partner) => {
        const IconComponent =
          ICON_MAP[partner.iconName as keyof typeof ICON_MAP];

        return (
          <div
            key={partner.id}
            className="flex items-start gap-2 rounded-md border border-border bg-background/60 px-2 py-2"
          >
            {IconComponent && (
              <IconComponent className="mt-[1px] h-3.5 w-3.5 flex-shrink-0 text-primary" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold leading-tight sm:text-xs">
                {partner.label}
              </p>
              <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground sm:text-[11px]">
                {partner.description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
