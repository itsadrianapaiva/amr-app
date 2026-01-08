import { describe, it, expect } from "vitest";
import {
  computeTotals,
  computeTotalsFromItems,
  type PriceInputs,
  type PricingContextInput,
  type PricingItemInput,
} from "@/lib/pricing";

describe("computeTotalsFromItems (Cart-ready pricing engine)", () => {
  describe("parity with computeTotals for single-item, day-based bookings", () => {
    it("matches computeTotals for basic rental only", () => {
      const inputs: PriceInputs = {
        rentalDays: 3,
        dailyRate: 99,
        deliverySelected: false,
        pickupSelected: false,
        insuranceSelected: false,
      };

      const context: PricingContextInput = {
        rentalDays: inputs.rentalDays,
        deliverySelected: inputs.deliverySelected,
        pickupSelected: inputs.pickupSelected,
        insuranceSelected: inputs.insuranceSelected,
      };

      const items: PricingItemInput[] = [
        {
          quantity: 1,
          chargeModel: "PER_BOOKING",
          timeUnit: "DAY",
          unitPrice: inputs.dailyRate,
        },
      ];

      const oldResult = computeTotals(inputs);
      const newResult = computeTotalsFromItems(context, items);

      expect(newResult).toEqual(oldResult);
    });

    it("matches computeTotals with delivery and pickup", () => {
      const inputs: PriceInputs = {
        rentalDays: 2,
        dailyRate: 185,
        deliverySelected: true,
        pickupSelected: true,
        insuranceSelected: false,
        deliveryCharge: 100,
        pickupCharge: 100,
      };

      const context: PricingContextInput = {
        rentalDays: inputs.rentalDays,
        deliverySelected: inputs.deliverySelected,
        pickupSelected: inputs.pickupSelected,
        insuranceSelected: inputs.insuranceSelected,
        deliveryCharge: inputs.deliveryCharge,
        pickupCharge: inputs.pickupCharge,
      };

      const items: PricingItemInput[] = [
        {
          quantity: 1,
          chargeModel: "PER_BOOKING",
          timeUnit: "DAY",
          unitPrice: inputs.dailyRate,
        },
      ];

      const oldResult = computeTotals(inputs);
      const newResult = computeTotalsFromItems(context, items);

      expect(newResult).toEqual(oldResult);
    });

    it("matches computeTotals with insurance", () => {
      const inputs: PriceInputs = {
        rentalDays: 3,
        dailyRate: 99,
        deliverySelected: false,
        pickupSelected: false,
        insuranceSelected: true,
        insuranceCharge: 50,
      };

      const context: PricingContextInput = {
        rentalDays: inputs.rentalDays,
        deliverySelected: inputs.deliverySelected,
        pickupSelected: inputs.pickupSelected,
        insuranceSelected: inputs.insuranceSelected,
        insuranceCharge: inputs.insuranceCharge,
      };

      const items: PricingItemInput[] = [
        {
          quantity: 1,
          chargeModel: "PER_BOOKING",
          timeUnit: "DAY",
          unitPrice: inputs.dailyRate,
        },
      ];

      const oldResult = computeTotals(inputs);
      const newResult = computeTotalsFromItems(context, items);

      expect(newResult).toEqual(oldResult);
    });

    it("matches computeTotals with operator", () => {
      const inputs: PriceInputs = {
        rentalDays: 2,
        dailyRate: 210,
        deliverySelected: false,
        pickupSelected: false,
        insuranceSelected: false,
        operatorSelected: true,
        operatorCharge: 350,
      };

      const context: PricingContextInput = {
        rentalDays: inputs.rentalDays,
        deliverySelected: inputs.deliverySelected,
        pickupSelected: inputs.pickupSelected,
        insuranceSelected: inputs.insuranceSelected,
        operatorSelected: inputs.operatorSelected,
        operatorCharge: inputs.operatorCharge,
      };

      const items: PricingItemInput[] = [
        {
          quantity: 1,
          chargeModel: "PER_BOOKING",
          timeUnit: "DAY",
          unitPrice: inputs.dailyRate,
        },
      ];

      const oldResult = computeTotals(inputs);
      const newResult = computeTotalsFromItems(context, items);

      expect(newResult).toEqual(oldResult);
    });

    it("matches computeTotals with discount", () => {
      const inputs: PriceInputs = {
        rentalDays: 3,
        dailyRate: 99,
        deliverySelected: true,
        pickupSelected: true,
        insuranceSelected: true,
        deliveryCharge: 40,
        pickupCharge: 40,
        insuranceCharge: 50,
        discountPercentage: 10,
      };

      const context: PricingContextInput = {
        rentalDays: inputs.rentalDays,
        deliverySelected: inputs.deliverySelected,
        pickupSelected: inputs.pickupSelected,
        insuranceSelected: inputs.insuranceSelected,
        deliveryCharge: inputs.deliveryCharge,
        pickupCharge: inputs.pickupCharge,
        insuranceCharge: inputs.insuranceCharge,
        discountPercentage: inputs.discountPercentage,
      };

      const items: PricingItemInput[] = [
        {
          quantity: 1,
          chargeModel: "PER_BOOKING",
          timeUnit: "DAY",
          unitPrice: inputs.dailyRate,
        },
      ];

      const oldResult = computeTotals(inputs);
      const newResult = computeTotalsFromItems(context, items);

      expect(newResult).toEqual(oldResult);
    });

    it("matches computeTotals with all add-ons", () => {
      const inputs: PriceInputs = {
        rentalDays: 7,
        dailyRate: 295,
        deliverySelected: true,
        pickupSelected: true,
        insuranceSelected: true,
        operatorSelected: true,
        deliveryCharge: 250,
        pickupCharge: 250,
        insuranceCharge: 50,
        operatorCharge: 350,
        discountPercentage: 5,
      };

      const context: PricingContextInput = {
        rentalDays: inputs.rentalDays,
        deliverySelected: inputs.deliverySelected,
        pickupSelected: inputs.pickupSelected,
        insuranceSelected: inputs.insuranceSelected,
        operatorSelected: inputs.operatorSelected,
        deliveryCharge: inputs.deliveryCharge,
        pickupCharge: inputs.pickupCharge,
        insuranceCharge: inputs.insuranceCharge,
        operatorCharge: inputs.operatorCharge,
        discountPercentage: inputs.discountPercentage,
      };

      const items: PricingItemInput[] = [
        {
          quantity: 1,
          chargeModel: "PER_BOOKING",
          timeUnit: "DAY",
          unitPrice: inputs.dailyRate,
        },
      ];

      const oldResult = computeTotals(inputs);
      const newResult = computeTotalsFromItems(context, items);

      expect(newResult).toEqual(oldResult);
    });
  });

  describe("HOUR timeUnit validation", () => {
    it("throws for HOUR timeUnit (not yet implemented)", () => {
      expect(() =>
        computeTotalsFromItems(
          {
            rentalDays: 1,
            deliverySelected: false,
            pickupSelected: false,
            insuranceSelected: false,
          },
          [
            {
              quantity: 1,
              chargeModel: "PER_BOOKING",
              timeUnit: "HOUR",
              unitPrice: 100,
            },
          ]
        )
      ).toThrow("HOUR-based pricing not yet implemented");
    });
  });

  describe("NONE timeUnit (flat, no duration multiplication)", () => {
    it("applies flat charge without duration multiplication (PER_BOOKING)", () => {
      const result = computeTotalsFromItems(
        {
          rentalDays: 3,
          deliverySelected: false,
          pickupSelected: false,
          insuranceSelected: false,
        },
        [
          {
            quantity: 1,
            chargeModel: "PER_BOOKING",
            timeUnit: "NONE",
            unitPrice: 50,
          },
        ]
      );

      expect(result.subtotal).toBe(50); // 50 * 1 (no duration multiplication)
      expect(result.total).toBe(50);
      expect(result.rentalDays).toBe(3); // context preserved
    });

    it("applies flat charge per unit (PER_UNIT)", () => {
      const result = computeTotalsFromItems(
        {
          rentalDays: 2,
          deliverySelected: false,
          pickupSelected: false,
          insuranceSelected: false,
        },
        [
          {
            quantity: 3,
            chargeModel: "PER_UNIT",
            timeUnit: "NONE",
            unitPrice: 20,
          },
        ]
      );

      expect(result.subtotal).toBe(60); // 20 * 3 (quantity), no duration
      expect(result.total).toBe(60);
    });

    it("combines PRIMARY machine (DAY) with ADDON items (NONE)", () => {
      const result = computeTotalsFromItems(
        {
          rentalDays: 3,
          deliverySelected: false,
          pickupSelected: false,
          insuranceSelected: false,
        },
        [
          // Primary machine: day-based
          {
            quantity: 1,
            chargeModel: "PER_BOOKING",
            timeUnit: "DAY",
            unitPrice: 99,
          },
          // Addon delivery: flat
          {
            quantity: 1,
            chargeModel: "PER_BOOKING",
            timeUnit: "NONE",
            unitPrice: 40,
          },
          // Addon pickup: flat
          {
            quantity: 1,
            chargeModel: "PER_BOOKING",
            timeUnit: "NONE",
            unitPrice: 40,
          },
        ]
      );

      expect(result.subtotal).toBe(377); // (99 * 3) + 40 + 40 = 297 + 80 = 377
      expect(result.total).toBe(377);
    });

    it("handles discount with NONE items", () => {
      const result = computeTotalsFromItems(
        {
          rentalDays: 2,
          deliverySelected: false,
          pickupSelected: false,
          insuranceSelected: false,
          discountPercentage: 10,
        },
        [
          {
            quantity: 1,
            chargeModel: "PER_BOOKING",
            timeUnit: "DAY",
            unitPrice: 100,
          },
          {
            quantity: 1,
            chargeModel: "PER_BOOKING",
            timeUnit: "NONE",
            unitPrice: 50,
          },
        ]
      );

      const subtotal = 100 * 2 + 50; // 250
      const discount = subtotal * 0.1; // 25
      expect(result.subtotal).toBe(250);
      expect(result.discount).toBe(25);
      expect(result.total).toBe(225); // 250 - 25
    });
  });
});
