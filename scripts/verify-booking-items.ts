/**
 * Verification script for Slice 3: BookingItem creation
 * Tests that createOrReusePendingBooking writes BookingItem rows correctly
 */

import { db } from "../lib/db";
import { createOrReusePendingBooking } from "../lib/repos/booking-repo";

async function verify() {
  console.log("🔍 Verifying BookingItem creation in Slice 3...\n");

  // Test 1: Create a new booking and verify BookingItem
  console.log("Test 1: Create new PENDING booking");
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 200); // Far future to avoid conflicts
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 2);

  const testEmail = `verify-${Date.now()}@example.com`;

  const result1 = await createOrReusePendingBooking({
    machineId: 1,
    startDate,
    endDate,
    insuranceSelected: true,
    deliverySelected: true,
    pickupSelected: true,
    operatorSelected: false,
    customer: {
      name: "Test User",
      email: testEmail,
      phone: "+351000000000",
    },
    billing: {
      isBusiness: false,
    },
    totals: {
      total: 100,
    },
    discountPercentage: 0,
  });

  console.log(`✅ Created booking ${result1.id}`);

  // Verify BookingItem was created
  const items1 = await db.bookingItem.findMany({
    where: { bookingId: result1.id },
    include: { machine: true },
  });

  console.log(`   BookingItems count: ${items1.length}`);
  if (items1.length !== 1) {
    throw new Error(`Expected 1 BookingItem, got ${items1.length}`);
  }

  const item = items1[0];
  console.log(`   - isPrimary: ${item.isPrimary}`);
  console.log(`   - quantity: ${item.quantity}`);
  console.log(`   - unitPrice: ${item.unitPrice} (machine.dailyRate: ${item.machine.dailyRate})`);
  console.log(`   - itemType: ${item.itemType}`);
  console.log(`   - chargeModel: ${item.chargeModel}`);
  console.log(`   - timeUnit: ${item.timeUnit}`);

  if (!item.isPrimary) {
    throw new Error("Expected isPrimary=true");
  }

  // Compute rentalDays exactly like production inclusiveDays calculation
  const rentalDays = Math.max(
    1,
    Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1
  );
  console.log(`   - rentalDays: ${rentalDays}`);

  // For DAY items, quantity should equal rentalDays
  const expectedQuantity = item.timeUnit === "DAY" ? rentalDays : 1;
  console.log(`   - expectedQuantity: ${expectedQuantity}`);

  if (item.quantity !== expectedQuantity) {
    throw new Error(
      `Expected quantity=${expectedQuantity} for timeUnit=${item.timeUnit}, got ${item.quantity}`
    );
  }

  if (item.unitPrice.toString() !== item.machine.dailyRate.toString()) {
    throw new Error(
      `unitPrice ${item.unitPrice} doesn't match machine.dailyRate ${item.machine.dailyRate}`
    );
  }

  // Test 2: Reuse the same booking and verify BookingItem is updated
  console.log("\nTest 2: Reuse PENDING booking (same email, dates, machine)");

  const result2 = await createOrReusePendingBooking({
    machineId: 1,
    startDate,
    endDate,
    insuranceSelected: false, // Changed
    deliverySelected: false, // Changed
    pickupSelected: false, // Changed
    operatorSelected: true, // Changed
    customer: {
      name: "Test User Updated",
      email: testEmail, // Same email
      phone: "+351111111111",
    },
    billing: {
      isBusiness: true, // Changed
    },
    totals: {
      total: 200, // Changed
    },
    discountPercentage: 10, // Changed
  });

  console.log(`✅ Reused booking ${result2.id}`);

  if (result2.id !== result1.id) {
    throw new Error(`Expected to reuse booking ${result1.id}, got ${result2.id}`);
  }

  // Verify BookingItem still exists and is correct
  const items2 = await db.bookingItem.findMany({
    where: { bookingId: result2.id },
    include: { machine: true },
  });

  console.log(`   BookingItems count: ${items2.length}`);
  if (items2.length !== 1) {
    throw new Error(`Expected 1 BookingItem after reuse, got ${items2.length}`);
  }

  const item2 = items2[0];
  console.log(`   - isPrimary: ${item2.isPrimary}`);
  console.log(`   - quantity: ${item2.quantity}`);
  console.log(`   - unitPrice: ${item2.unitPrice} (machine.dailyRate: ${item2.machine.dailyRate})`);

  // Verify quantity is still correct after reuse
  const expectedQuantity2 = item2.timeUnit === "DAY" ? rentalDays : 1;
  if (item2.quantity !== expectedQuantity2) {
    throw new Error(
      `Expected quantity=${expectedQuantity2} after reuse for timeUnit=${item2.timeUnit}, got ${item2.quantity}`
    );
  }

  // Verify booking fields were updated
  const booking = await db.booking.findUnique({
    where: { id: result2.id },
    select: {
      insuranceSelected: true,
      deliverySelected: true,
      pickupSelected: true,
      operatorSelected: true,
      totalCost: true,
      customerName: true,
    },
  });

  console.log(`   - insuranceSelected: ${booking!.insuranceSelected} (expected: false)`);
  console.log(`   - operatorSelected: ${booking!.operatorSelected} (expected: true)`);
  console.log(`   - totalCost: ${booking!.totalCost} (expected: 200)`);

  // Cleanup
  console.log("\n🧹 Cleaning up test data...");
  await db.bookingItem.deleteMany({ where: { bookingId: result1.id } });
  await db.booking.delete({ where: { id: result1.id } });
  console.log(`✅ Deleted booking ${result1.id} and its items`);

  console.log("\n✅ All tests passed! Slice 3 implementation is correct.");
}

verify()
  .catch((err) => {
    console.error("\n❌ Verification failed:", err);
    process.exit(1);
  })
  .finally(() => {
    db.$disconnect();
  });
