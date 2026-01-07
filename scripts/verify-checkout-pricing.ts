/**
 * Verification script for Slice 4: Checkout pricing parity
 * Tests that computeTotalsFromItems produces identical results to computeTotals
 * for the specific patterns used in create-checkout.ts
 */

import {
  computeTotals,
  computeTotalsFromItems,
  type PricingContextInput,
  type PricingItemInput,
} from "../lib/pricing";

function testParity(scenario: string, args: any) {
  console.log(`\nTesting: ${scenario}`);

  // Old approach (legacy)
  const oldResult = computeTotals(args);

  // New approach (Slice 4: hardcoded overrides)
  const context: PricingContextInput = {
    rentalDays: args.rentalDays,
    deliverySelected: args.deliverySelected,
    pickupSelected: args.pickupSelected,
    insuranceSelected: args.insuranceSelected,
    operatorSelected: args.operatorSelected ?? false,
    deliveryCharge: args.deliveryCharge ?? 0,
    pickupCharge: args.pickupCharge ?? 0,
    insuranceCharge: args.insuranceCharge ?? 0,
    operatorCharge: args.operatorCharge ?? 0,
    discountPercentage: args.discountPercentage ?? 0,
  };

  const items: PricingItemInput[] = [
    {
      quantity: 1,
      chargeModel: "PER_BOOKING", // Slice 4 safety override
      timeUnit: "DAY", // Slice 4 safety override
      unitPrice: args.dailyRate,
    },
  ];

  const newResult = computeTotalsFromItems(context, items);

  // Compare results
  const matches =
    oldResult.total === newResult.total &&
    oldResult.subtotal === newResult.subtotal &&
    oldResult.delivery === newResult.delivery &&
    oldResult.pickup === newResult.pickup &&
    oldResult.insurance === newResult.insurance &&
    oldResult.operator === newResult.operator &&
    oldResult.discount === newResult.discount &&
    oldResult.rentalDays === newResult.rentalDays;

  if (matches) {
    console.log(`✅ PASS - totals match: ${newResult.total} EUR`);
  } else {
    console.log(`❌ FAIL - totals differ:`);
    console.log(`  Old:`, oldResult);
    console.log(`  New:`, newResult);
    throw new Error(`Pricing parity broken for: ${scenario}`);
  }
}

console.log("🔍 Verifying checkout pricing parity (Slice 4)...\n");

// Test 1: Basic rental only (no add-ons)
testParity("Basic rental (3 days @ 99/day)", {
  rentalDays: 3,
  dailyRate: 99,
  deliverySelected: false,
  pickupSelected: false,
  insuranceSelected: false,
  operatorSelected: false,
});

// Test 2: Rental with delivery and pickup
testParity("Rental with delivery (100) and pickup (100)", {
  rentalDays: 2,
  dailyRate: 185,
  deliverySelected: true,
  pickupSelected: true,
  insuranceSelected: false,
  operatorSelected: false,
  deliveryCharge: 100,
  pickupCharge: 100,
});

// Test 3: Rental with insurance
testParity("Rental with insurance (50)", {
  rentalDays: 3,
  dailyRate: 99,
  deliverySelected: false,
  pickupSelected: false,
  insuranceSelected: true,
  operatorSelected: false,
  insuranceCharge: 50,
});

// Test 4: Rental with operator
testParity("Rental with operator (350/day)", {
  rentalDays: 2,
  dailyRate: 210,
  deliverySelected: false,
  pickupSelected: false,
  insuranceSelected: false,
  operatorSelected: true,
  operatorCharge: 350,
});

// Test 5: Rental with 10% discount
testParity("Rental with 10% discount", {
  rentalDays: 3,
  dailyRate: 99,
  deliverySelected: true,
  pickupSelected: true,
  insuranceSelected: true,
  operatorSelected: false,
  deliveryCharge: 40,
  pickupCharge: 40,
  insuranceCharge: 50,
  discountPercentage: 10,
});

// Test 6: Full booking with all add-ons and 5% discount
testParity("Full booking (all add-ons + 5% discount)", {
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

console.log("\n✅ All pricing parity tests passed!");
console.log(
  "   Checkout pricing behavior unchanged from Slice 3 to Slice 4."
);
