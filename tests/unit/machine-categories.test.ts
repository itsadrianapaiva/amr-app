/**
 * Unit tests for machine category mapping.
 *
 * REGRESSION GUARD: These tests ensure the category system stays consistent
 * and prevents drift between CSV data, seed validation, and UI display.
 *
 * If this test fails, it likely means:
 * - A category label was changed without updating all aliases
 * - The normalization logic was modified incorrectly
 * - Someone bypassed the shared module and reintroduced duplication
 */

import { describe, it, expect } from "vitest";
import {
  normalizeCategoryKey,
  resolveCategoryLabel,
  isCategoryKnown,
  CATEGORY_LABELS_BY_KEY,
} from "@/lib/content/machine-categories";

describe("machine-categories", () => {
  describe("normalizeCategoryKey", () => {
    it("should normalize category strings consistently", () => {
      // Lowercase conversion
      expect(normalizeCategoryKey("Skid Steer Loaders")).toBe("skid steer loaders");
      expect(normalizeCategoryKey("EXCAVATORS")).toBe("excavators");

      // Special character removal (keep only alphanumeric and spaces)
      expect(normalizeCategoryKey("Light Machinery & Tools")).toBe("light machinery tools");
      expect(normalizeCategoryKey("Trucks-and-Haulers")).toBe("trucks and haulers");

      // Trim and collapse multiple spaces
      expect(normalizeCategoryKey("  Bobcat   Skid  Steer  ")).toBe("bobcat skid steer");
      expect(normalizeCategoryKey("Mini\t\tExcavators")).toBe("mini excavators");

      // Empty/null fallback
      expect(normalizeCategoryKey("")).toBe("uncategorized");
      expect(normalizeCategoryKey(null)).toBe("uncategorized");
      expect(normalizeCategoryKey(undefined)).toBe("uncategorized");
    });
  });

  describe("resolveCategoryLabel", () => {
    it("should resolve exact category labels", () => {
      expect(resolveCategoryLabel("Skid Steer Loaders")).toBe("Skid Steer Loaders");
      expect(resolveCategoryLabel("Excavators")).toBe("Excavators");
      expect(resolveCategoryLabel("Trucks and Haulers")).toBe("Trucks and Haulers");
    });

    it("should resolve category aliases to display labels", () => {
      // Skid steer aliases
      expect(resolveCategoryLabel("Skid Steer")).toBe("Skid Steer Loaders");
      expect(resolveCategoryLabel("Bobcat")).toBe("Skid Steer Loaders");
      expect(resolveCategoryLabel("skid")).toBe("Skid Steer Loaders");

      // Excavator aliases
      expect(resolveCategoryLabel("Excavator")).toBe("Excavators");
      expect(resolveCategoryLabel("Mini Excavator")).toBe("Mini Excavators");

      // Truck aliases
      expect(resolveCategoryLabel("Trucks")).toBe("Trucks");
      expect(resolveCategoryLabel("Haulers")).toBe("Haulers");
      expect(resolveCategoryLabel("trucksandhaulers")).toBe("Trucks and Haulers");
    });

    it("should be case-insensitive", () => {
      expect(resolveCategoryLabel("EXCAVATORS")).toBe("Excavators");
      expect(resolveCategoryLabel("excavators")).toBe("Excavators");
      expect(resolveCategoryLabel("ExCaVaToRs")).toBe("Excavators");
    });

    it("should handle special characters in input", () => {
      expect(resolveCategoryLabel("Light Machinery & Tools")).toBe("Light Machinery & Tools");
      expect(resolveCategoryLabel("Light-Machinery-Tools")).toBe("Light Machinery & Tools");
    });

    it("should return null for unknown categories", () => {
      expect(resolveCategoryLabel("Skid Steer Loaderz")).toBe(null); // typo
      expect(resolveCategoryLabel("Dumpers")).toBe(null); // not a valid category
      expect(resolveCategoryLabel("Random Category")).toBe(null);
      expect(resolveCategoryLabel("")).toBe("Uncategorized"); // empty maps to uncategorized
    });
  });

  describe("isCategoryKnown", () => {
    it("should return true for known categories", () => {
      expect(isCategoryKnown("Skid Steer Loaders")).toBe(true);
      expect(isCategoryKnown("Excavators")).toBe(true);
      expect(isCategoryKnown("Mini Excavators")).toBe(true);
      expect(isCategoryKnown("Trucks and Haulers")).toBe(true);
      expect(isCategoryKnown("Heavy Equipment")).toBe(true);
      expect(isCategoryKnown("Light Machinery & Tools")).toBe(true);
      expect(isCategoryKnown("Addons")).toBe(true);
    });

    it("should return true for category aliases", () => {
      expect(isCategoryKnown("Bobcat")).toBe(true);
      expect(isCategoryKnown("Excavator")).toBe(true);
      expect(isCategoryKnown("Trucks")).toBe(true);
      expect(isCategoryKnown("Haulers")).toBe(true);
      expect(isCategoryKnown("Power Washer")).toBe(true);
    });

    it("should return false for unknown categories", () => {
      expect(isCategoryKnown("Skid Steer Loaderz")).toBe(false); // typo
      expect(isCategoryKnown("Dumpers")).toBe(false); // not valid
      expect(isCategoryKnown("Random Category")).toBe(false);
    });

    it("should be case-insensitive", () => {
      expect(isCategoryKnown("EXCAVATORS")).toBe(true);
      expect(isCategoryKnown("excavators")).toBe(true);
      expect(isCategoryKnown("ExCaVaToRs")).toBe(true);
    });
  });

  describe("CATEGORY_LABELS_BY_KEY integrity", () => {
    it("should have at least the core categories", () => {
      const coreCategories = [
        "skid steer loaders",
        "excavators",
        "mini excavators",
        "trucks and haulers",
        "heavy equipment",
        "light machinery tools", // normalized version
        "addons",
        "uncategorized",
      ];

      for (const category of coreCategories) {
        expect(CATEGORY_LABELS_BY_KEY).toHaveProperty(category);
      }
    });

    it("should have all keys in normalized form", () => {
      // All keys must be already normalized (lowercase, no special chars except spaces)
      for (const key of Object.keys(CATEGORY_LABELS_BY_KEY)) {
        const normalized = normalizeCategoryKey(key);
        expect(key).toBe(normalized);
      }
    });

    it("should have non-empty display labels", () => {
      for (const [key, label] of Object.entries(CATEGORY_LABELS_BY_KEY)) {
        expect(label).toBeTruthy();
        expect(label.length).toBeGreaterThan(0);
      }
    });
  });

  describe("CSV compatibility (regression prevention)", () => {
    it("should recognize all categories currently used in CSV", () => {
      // These are the actual categories from machines.csv as of 2026-01-14
      const csvCategories = [
        "Skid Steer Loaders",
        "Excavators",
        "Heavy Equipment",
        "Light Machinery & Tools",
        "Trucks and Haulers",
        "Addons",
      ];

      for (const category of csvCategories) {
        expect(isCategoryKnown(category)).toBe(true);
        expect(resolveCategoryLabel(category)).not.toBe(null);
      }
    });

    it("should warn about typos (example: Skid Steer Loaderz)", () => {
      // This is what the seed script checks for - catch common typos
      expect(isCategoryKnown("Skid Steer Loaderz")).toBe(false);
      expect(resolveCategoryLabel("Skid Steer Loaderz")).toBe(null);
    });
  });
});
