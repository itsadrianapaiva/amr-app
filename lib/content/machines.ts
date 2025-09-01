/**
 * Copy and tiny helpers for machine cards.
 * Keep all wording here so we can tune language without touching components.
 * The component will pass already-formatted currency strings.
 */

export type MachineCardCopy = {
  /** Small badge to reinforce the USP. Leave empty to hide. */
  preBadge: string;
  labels: {
    deliveryAvailable: string;
    pickupAvailable: string;
    operatorAvailable: string;
  };
  formatPricePerDay: (price: string) => string; // price is already currency-formatted
  formatMinDays: (days: number) => string;
  formatDeposit: (amount: string) => string; // amount is already currency-formatted
  displayType: (raw?: string | null) => string;
};

export const MACHINE_CARD_COPY: MachineCardCopy = {
  preBadge: "Instant online booking",
  labels: {
    deliveryAvailable: "Delivery available",
    pickupAvailable: "Pickup available",
    operatorAvailable: "Operator available",
  },
  formatPricePerDay: (price) => `from ${price}/day`,
  formatMinDays: (days) => (days > 1 ? `min ${days} days` : "1 day minimum"),
  formatDeposit: (amount) => `Deposit ${amount}`,
  displayType: (raw) => {
    // Normalize category text safely. Replace with a mapping if you want friendlier labels.
    const t = (raw ?? "").trim();
    return t.length ? t : "Uncategorized";
  },
};
