/**
 * Upsert a €1 internal test machine for Stripe prod flow.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." npx tsx scripts/upsert-test-machine.ts
 *
 * Idempotent: re-running keeps it updated.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Keep the name unique and clearly internal-only.
  const name = "ZZZ Internal Test Machine (€1 - Do Not Rent)";

  const data = {
    name,                           // unique key for upsert
    category: "Light Machinery & Tools",
    model: "TEST-1",
    weight: "",                     // optional
    description:
      "Internal listing to verify Stripe production checkout. Not available for hire. Charges kept at €1/day with a €1 deposit for testing; remove after validation.",
    dailyRate: 1,                   // €1/day
    deposit: 1,                     // €1 deposit
    minDays: 1,                     // 1-day rental
    deliveryCharge: 0,              // keep totals tiny
    pickupCharge: 0,                // keep totals tiny
    imageUrl: "/images/machines/_fallback.jpg", // we don’t render DB URLs
    referenceUrl: null,             // reference-only; not used by UI
  };

  const row = await prisma.machine.upsert({
    where: { name },
    create: data,
    update: data,
  });

  console.log(
    `Upserted test machine: id=${row.id} name="${row.name}" price=${row.dailyRate} deposit=${row.deposit}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
