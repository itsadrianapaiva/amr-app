/**
 * Copy and tiny helpers for machine cards.
 * Keep wording centralized so we can tune language without touching components.
 * The component passes already-formatted currency strings.
 */

import { toTitleCase } from "@/lib/utils";
import { resolveCategoryLabel } from "./machine-categories";

export type MachineCardCopy = {
  preBadge: string;
  labels: {
    deliveryAvailable: string;
    pickupAvailable: string;
    operatorAvailable: string;
  };
  formatPricePerDay: (price: string) => string;
  formatMinDays: (days: number) => string;
  formatDeposit: (amount: string) => string;
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
    const label = resolveCategoryLabel(raw);
    return label ?? (raw ? toTitleCase(raw) : "Uncategorized");
  },
};
