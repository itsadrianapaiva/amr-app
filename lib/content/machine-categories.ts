/**
 * Shared, server-safe category mapping for machines.
 * Single source of truth for both UI display and seed validation.
 *
 * ADD NEW CATEGORIES HERE:
 * 1. Add normalized key → display label mapping to CATEGORY_LABELS_BY_KEY
 * 2. Use normalized keys (lowercase, alphanumeric+spaces only)
 * 3. Add aliases as needed (e.g., "skid" → "Skid Steer Loaders")
 *
 * This module is pure TypeScript with no React/client-only imports.
 */

/**
 * Normalizes a category string for consistent mapping.
 * - Lowercase
 * - Remove special characters (keep alphanumeric and spaces)
 * - Trim and collapse multiple spaces to single space
 */
export function normalizeCategoryKey(raw?: string | null): string {
  if (!raw) return "uncategorized";
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Friendly display labels for categories.
 * Keys MUST be normalized via normalizeCategoryKey.
 * Add aliases so different CSV values map to the same display label.
 */
export const CATEGORY_LABELS_BY_KEY: Record<string, string> = {
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

  // Known categories that use title case fallback (not primary labels but valid)
  "heavy equipment": "Heavy Equipment",
  "light machinery tools": "Light Machinery & Tools",
  "light machinery & tools": "Light Machinery & Tools",

  // Addons
  addons: "Addons",

  // Fallback
  uncategorized: "Uncategorized",
};

/**
 * Checks if a category string is recognized (after normalization).
 * Used by seed script to warn about unknown categories in CSV.
 */
export function isCategoryKnown(raw?: string | null): boolean {
  const normalized = normalizeCategoryKey(raw);
  return normalized in CATEGORY_LABELS_BY_KEY;
}

/**
 * Resolves a raw category string to its display label.
 * Returns the mapped label if found, or null if unknown.
 * For unknown categories, caller should use toTitleCase() as fallback.
 */
export function resolveCategoryLabel(raw?: string | null): string | null {
  const normalized = normalizeCategoryKey(raw);
  return CATEGORY_LABELS_BY_KEY[normalized] ?? null;
}
