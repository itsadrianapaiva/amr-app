import { describe, it, expect } from "vitest";
import {
  computeTotals,
  computeTotalsFromItems,
  computeRentalDays,
  type PriceInputs,
  type PricingContextInput,
  type PricingItemInput,
} from "@/lib/pricing";

describe("computeRentalDays", () => {
  it("returns 0 for undefined dates", () => {
    expect(computeRentalDays()).toBe(0);
    expect(computeRentalDays(undefined, new Date())).toBe(0);
    expect(computeRentalDays(new Date(), undefined)).toBe(0);
  });

  it("computes inclusive days correctly", () => {
    // 10th to 10th = 1 day
    const same = computeRentalDays(
      new Date("2025-09-10"),
      new Date("2025-09-10")
    );
    expect(same).toBe(1);

    // 10th to 12th = 3 days
    const multi = computeRentalDays(
      new Date("2025-09-10"),
      new Date("2025-09-12")
    );
    expect(multi).toBe(3);
  });
});

describe("computeTotals (existing function)", () => {
  it("computes basic rental only", () => {
    const result = computeTotals({
      rentalDays: 3,
      dailyRate: 99,
      deliverySelected: false,
      pickupSelected: false,
      insuranceSelected: false,
    });

    expect(result).toEqual({
      rentalDays: 3,
      subtotal: 297, // 3 * 99
      delivery: 0,
      pickup: 0,
      insurance: 0,
      operator: 0,
      discount: 0,
      total: 297,
    });
  });

  it("computes rental with delivery and pickup", () => {
    const result = computeTotals({
      rentalDays: 2,
      dailyRate: 185,
      deliverySelected: true,
      pickupSelected: true,
      insuranceSelected: false,
      deliveryCharge: 100,
      pickupCharge: 100,
    });

    expect(result).toEqual({
      rentalDays: 2,
      subtotal: 370, // 2 * 185
      delivery: 100,
      pickup: 100,
      insurance: 0,
      operator: 0,
      discount: 0,
      total: 570, // 370 + 100 + 100
    });
  });

  it("computes rental with insurance", () => {
    const result = computeTotals({
      rentalDays: 3,
      dailyRate: 99,
      deliverySelected: false,
      pickupSelected: false,
      insuranceSelected: true,
      insuranceCharge: 50,
    });

    expect(result).toEqual({
      rentalDays: 3,
      subtotal: 297,
      delivery: 0,
      pickup: 0,
      insurance: 50,
      operator: 0,
      discount: 0,
      total: 347, // 297 + 50
    });
  });

  it("ignores insurance when insuranceCharge is null", () => {
    const result = computeTotals({
      rentalDays: 3,
      dailyRate: 99,
      deliverySelected: false,
      pickupSelected: false,
      insuranceSelected: true,
      insuranceCharge: null, // TBD, not counted
    });

    expect(result.insurance).toBe(0);
    expect(result.total).toBe(297);
  });

  it("computes rental with operator (per-day charge)", () => {
    const result = computeTotals({
      rentalDays: 2,
      dailyRate: 210,
      deliverySelected: false,
      pickupSelected: false,
      insuranceSelected: false,
      operatorSelected: true,
      operatorCharge: 350,
    });

    expect(result).toEqual({
      rentalDays: 2,
      subtotal: 420, // 2 * 210
      delivery: 0,
      pickup: 0,
      insurance: 0,
      operator: 700, // 350 * 2 days
      discount: 0,
      total: 1120, // 420 + 700
    });
  });

  it("applies discount percentage to entire subtotal", () => {
    const result = computeTotals({
      rentalDays: 3,
      dailyRate: 99,
      deliverySelected: true,
      pickupSelected: true,
      insuranceSelected: true,
      deliveryCharge: 40,
      pickupCharge: 40,
      insuranceCharge: 50,
      discountPercentage: 10, // 10% off
    });

    const subtotalBefore = 297 + 40 + 40 + 50; // 427
    const discountAmount = 42.7; // 10% of 427
    const expectedTotal = 427 - 42.7; // 384.3

    expect(result.discount).toBe(discountAmount);
    expect(result.total).toBe(expectedTotal);
  });

  it("handles all add-ons together", () => {
    const result = computeTotals({
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
    });

    const rental = 7 * 295; // 2065
    const operator = 7 * 350; // 2450
    const subtotalBefore = rental + 250 + 250 + 50 + operator; // 5065
    const discount = subtotalBefore * 0.05; // 253.25
    const expectedTotal = subtotalBefore - discount; // 4811.75

    expect(result.subtotal).toBe(rental);
    expect(result.operator).toBe(operator);
    expect(result.discount).toBe(discount);
    expect(result.total).toBe(expectedTotal);
  });
});

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

  describe("multi-item scenarios (Option B specific)", () => {
    it("prices multiple PER_BOOKING items correctly", () => {
      const result = computeTotalsFromItems(
        {
          rentalDays: 3,
          deliverySelected: false,
          pickupSelected: false,
          insuranceSelected: false,
        },
        [
          { quantity: 1, chargeModel: "PER_BOOKING", timeUnit: "DAY", unitPrice: 99 },
          { quantity: 1, chargeModel: "PER_BOOKING", timeUnit: "DAY", unitPrice: 35 },
        ]
      );

      // Item 1: 99 * 3 = 297
      // Item 2: 35 * 3 = 105
      // Total: 402
      expect(result.subtotal).toBe(402);
      expect(result.total).toBe(402);
    });

    it("prices PER_UNIT items with quantity correctly", () => {
      const result = computeTotalsFromItems(
        {
          rentalDays: 2,
          deliverySelected: false,
          pickupSelected: false,
          insuranceSelected: false,
        },
        [
          { quantity: 3, chargeModel: "PER_UNIT", timeUnit: "DAY", unitPrice: 25 },
        ]
      );

      // 3 units * 25 per unit * 2 days = 150
      expect(result.subtotal).toBe(150);
      expect(result.total).toBe(150);
    });

    it("mixes PER_BOOKING and PER_UNIT items", () => {
      const result = computeTotalsFromItems(
        {
          rentalDays: 5,
          deliverySelected: true,
          pickupSelected: true,
          insuranceSelected: false,
          deliveryCharge: 100,
          pickupCharge: 100,
        },
        [
          { quantity: 1, chargeModel: "PER_BOOKING", timeUnit: "DAY", unitPrice: 185 }, // Primary machine
          { quantity: 2, chargeModel: "PER_UNIT", timeUnit: "DAY", unitPrice: 30 },     // Addon with quantity
        ]
      );

      // Primary: 185 * 5 = 925
      // Addon: (2 * 30) * 5 = 300
      // Subtotal: 1225
      // + delivery 100 + pickup 100 = 1425
      expect(result.subtotal).toBe(1225);
      expect(result.delivery).toBe(100);
      expect(result.pickup).toBe(100);
      expect(result.total).toBe(1425);
    });

    it("applies discount to multi-item subtotal", () => {
      const result = computeTotalsFromItems(
        {
          rentalDays: 3,
          deliverySelected: false,
          pickupSelected: false,
          insuranceSelected: false,
          discountPercentage: 15,
        },
        [
          { quantity: 1, chargeModel: "PER_BOOKING", timeUnit: "DAY", unitPrice: 100 },
          { quantity: 2, chargeModel: "PER_UNIT", timeUnit: "DAY", unitPrice: 20 },
        ]
      );

      // Item 1: 100 * 3 = 300
      // Item 2: (2 * 20) * 3 = 120
      // Subtotal: 420
      // Discount: 420 * 0.15 = 63
      // Total: 357
      expect(result.subtotal).toBe(420);
      expect(result.discount).toBe(63);
      expect(result.total).toBe(357);
    });
  });

  describe("error handling", () => {
    it("throws for unknown chargeModel", () => {
      expect(() =>
        computeTotalsFromItems(
          { rentalDays: 1, deliverySelected: false, pickupSelected: false, insuranceSelected: false },
          [{ quantity: 1, chargeModel: "UNKNOWN" as any, timeUnit: "DAY", unitPrice: 100 }]
        )
      ).toThrow("Unknown chargeModel: UNKNOWN");
    });

    it("throws for HOUR timeUnit (not yet implemented)", () => {
      expect(() =>
        computeTotalsFromItems(
          { rentalDays: 1, deliverySelected: false, pickupSelected: false, insuranceSelected: false },
          [{ quantity: 1, chargeModel: "PER_BOOKING", timeUnit: "HOUR", unitPrice: 100 }]
        )
      ).toThrow("HOUR-based pricing not yet implemented");
    });

    it("throws for unknown timeUnit", () => {
      expect(() =>
        computeTotalsFromItems(
          { rentalDays: 1, deliverySelected: false, pickupSelected: false, insuranceSelected: false },
          [{ quantity: 1, chargeModel: "PER_BOOKING", timeUnit: "WEEK" as any, unitPrice: 100 }]
        )
      ).toThrow("Unknown timeUnit: WEEK");
    });
  });

  describe("edge cases", () => {
    it("handles empty items array", () => {
      const result = computeTotalsFromItems(
        {
          rentalDays: 3,
          deliverySelected: true,
          pickupSelected: false,
          insuranceSelected: false,
          deliveryCharge: 50,
        },
        []
      );

      // No items, only delivery
      expect(result.subtotal).toBe(0);
      expect(result.delivery).toBe(50);
      expect(result.total).toBe(50);
    });

    it("handles zero rental days", () => {
      const result = computeTotalsFromItems(
        {
          rentalDays: 0,
          deliverySelected: false,
          pickupSelected: false,
          insuranceSelected: false,
        },
        [{ quantity: 1, chargeModel: "PER_BOOKING", timeUnit: "DAY", unitPrice: 100 }]
      );

      // 0 days means no rental charge
      expect(result.subtotal).toBe(0);
      expect(result.total).toBe(0);
    });

    it("handles null charges correctly", () => {
      const result = computeTotalsFromItems(
        {
          rentalDays: 2,
          deliverySelected: true,
          pickupSelected: true,
          insuranceSelected: true,
          operatorSelected: true,
          deliveryCharge: null,
          pickupCharge: null,
          insuranceCharge: null,
          operatorCharge: null,
        },
        [{ quantity: 1, chargeModel: "PER_BOOKING", timeUnit: "DAY", unitPrice: 50 }]
      );

      // All null charges treated as 0
      expect(result.delivery).toBe(0);
      expect(result.pickup).toBe(0);
      expect(result.insurance).toBe(0);
      expect(result.operator).toBe(0);
      expect(result.total).toBe(100); // Only 50 * 2 days
    });
  });
});
