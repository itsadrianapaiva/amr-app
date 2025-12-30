import { describe, it, expect } from "vitest";
import {
  computeTotals,
  computeTotalsFromItems,
  type PriceInputs,
  type PricingContextInput,
  type PricingItemInput,
} from "@/lib/pricing";

describe("computeTotalsFromItems (Option B pricing engine)", () => {
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
          { rentalDays: 1, deliverySelected: false, pickupSelected: false, insuranceSelected: false },
          [{ quantity: 1, chargeModel: "PER_BOOKING", timeUnit: "HOUR", unitPrice: 100 }]
        )
      ).toThrow("HOUR-based pricing not yet implemented");
    });
  });
});
