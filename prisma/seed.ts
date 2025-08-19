// prisma/seed.ts
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const machineData: Prisma.MachineCreateInput[] = [
  {
    name: "1300kg Digger",
    description:
      "A versatile 1.3 tonne digger, suitable for a wide range of excavation tasks.",
    imageUrl: "https://placehold.co/600x400/F5A623/FFFFFF?text=1.3T+Digger",
    dailyRate: 150,
    weight: "1300kg",
    deposit: 500,
    deliveryCharge: 100,
  },
  {
    name: "MB Button 1000",
    description:
      "A compact and efficient machine for smaller projects and tight access areas.",
    imageUrl: "https://placehold.co/600x400/F5A623/FFFFFF?text=MB+1000",
    dailyRate: 120,
    weight: "1000kg",
    deposit: 300,
    deliveryCharge: 80,
  },
  {
    name: "1800kg Excavator",
    description:
      "A powerful 1.8 tonne excavator for more demanding jobs requiring greater depth and power.",
    imageUrl: "https://placehold.co/600x400/F5A623/FFFFFF?text=1.8T+Excavator",
    dailyRate: 180,
    weight: "1800kg",
    deposit: 300,
    deliveryCharge: 120,
  },
  {
    name: "1500 Large Excavator",
    description:
      "A robust 1.5 tonne excavator with extended reach and capabilities.",
    imageUrl: "https://placehold.co/600x400/F5A623/FFFFFF?text=1.5T+Excavator",
    dailyRate: 220,
    weight: "1500kg",
    deposit: 400,
    deliveryCharge: 150,
  },
  {
    name: "355 Compact",
    description:
      "A lightweight and compact machine, perfect for landscaping and small construction work.",
    imageUrl: "https://placehold.co/600x400/F5A623/FFFFFF?text=355+Compact",
    dailyRate: 100,
    weight: "700kg",
    deposit: 200,
    deliveryCharge: 70,
  },
  {
    name: "255200 rom",
    description:
      "A highly mobile and efficient machine for various utility and construction tasks.",
    imageUrl: "https://placehold.co/600x400/F5A623/FFFFFF?text=255200+rom",
    dailyRate: 90,
    weight: "500kg",
    deposit: 200,
    deliveryCharge: 60,
  },
  {
    name: "250 Hyundai",
    description:
      "A reliable Hyundai model known for its performance and durability.",
    imageUrl: "https://placehold.co/600x400/F5A623/FFFFFF?text=Hyundai+250",
    dailyRate: 80,
    weight: "250kg",
    deposit: 300,
    deliveryCharge: 50,
  },
];

async function main() {
  console.log("Initializing database seeding with new data...");
  for (const m of machineData) {
    const machine = await prisma.machine.upsert({
      where: { name: m.name },
      update: m,
      create: m,
    });
    console.log(`Upserted machine: ${machine.name} (ID: ${machine.id})`);
  }
  console.log("Database seeding completed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
