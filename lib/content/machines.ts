/**
 * Copy and tiny helpers for machine cards.
 * Keep wording centralized so we can tune language without touching components.
 * The component passes already-formatted currency strings.
 */

import { toTitleCase } from "@/lib/utils";

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

function normalizeTypeKey(raw?: string | null): string {
  if (!raw) return "uncategorized";
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Friendly labels for categories (add/edit freely).
 * Keys MUST be normalized via normalizeTypeKey.
 * Add aliases so different CSV values map to the same display label.
 */
export const CATEGORY_LABELS: Record<string, string> = {
  // Skid steer / Bobcat
  "skid steer loaders": "Skid Steer Loaders",
  "skid steer": "Skid Steer Loaders",
  skid: "Skid Steer Loaders",
  bobcat: "Skid Steer Loaders",
  "bobcat skid steer": "Skid Steer Loaders",
  "skid steer with tracks": "Skid Steer Loaders",
  "skid steer w tracks": "Skid Steer Loaders",

  // Excavators (mini/medium/large)
  excavators: "Excavators",
  excavator: "Excavators",
  "mini excavators": "Mini Excavators",
  "mini excavator": "Mini Excavators",
  "medium excavator": "Excavators",
  "large excavator": "Excavators",

  // Telehandlers
  telehandler: "Telehandlers",
  telehandlers: "Telehandlers",

  // Compaction
  compactor: "Compactors",
  compactors: "Compactors",
  rammer: "Compactors",
  rammers: "Compactors",
  "plate compactor": "Plate Compactors",
  "plate compactors": "Plate Compactors",

  // Concrete mixers
  "concrete mixer": "Concrete Mixers",
  "concrete mixers": "Concrete Mixers",
  mixer: "Concrete Mixers",
  mixers: "Concrete Mixers",

  // Power washers / pressure washers
  powerwasher: "Power Washers",
  "power washer": "Power Washers",
  "power washers": "Power Washers",
  powerwashers: "Power Washers",
  "pressure washer": "Power Washers",
  "pressure washers": "Power Washers",

  // Hole boring machines
  holeboringmachine: "Hole Boring Machines",
  "hole boring machine": "Hole Boring Machines",
  "hole boring machines": "Hole Boring Machines",

  // Trucks and haulers
  trucks: "Trucks",
  truck: "Trucks",
  haulers: "Haulers",
  hauler: "Haulers",
  trucksandhaulers: "Trucks and Haulers",
  "trucks and haulers": "Trucks and Haulers",

  // Fallback
  uncategorized: "Uncategorized",
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
    const key = normalizeTypeKey(raw);
    return CATEGORY_LABELS[key] ?? (raw ? toTitleCase(raw) : "Uncategorized");
  },
};
