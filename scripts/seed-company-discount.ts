/**
 * Script to seed a company discount for testing
 * Usage: npx tsx scripts/seed-company-discount.ts
 */

import { db } from "../lib/db";

async function main() {
  const testNIF = "123456789";
  const discountPercentage = 10; // 10% discount
  const companyName = "Test Company Ltd";

  console.log("🔍 Checking if discount already exists...");

  const existing = await db.companyDiscount.findUnique({
    where: { nif: testNIF },
  });

  if (existing) {
    console.log("✅ Discount already exists for NIF:", testNIF);
    console.log("   Company:", existing.companyName);
    console.log("   Discount:", existing.discountPercentage + "%");
    console.log("   Active:", existing.active);
    return;
  }

  console.log("➕ Creating test company discount...");

  const discount = await db.companyDiscount.create({
    data: {
      nif: testNIF,
      discountPercentage,
      companyName,
      active: true,
    },
  });

  console.log("✅ Successfully created company discount:");
  console.log("   NIF:", discount.nif);
  console.log("   Company:", discount.companyName);
  console.log("   Discount:", discount.discountPercentage + "%");
  console.log("   Active:", discount.active);
  console.log("\n📝 To test, use NIF:", testNIF, "in the booking form");
}

main()
  .then(() => {
    console.log("\n✨ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });