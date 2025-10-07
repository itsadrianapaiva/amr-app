// Run with `DATABASE_URL="staging db" npx tsx scripts/seed-ops.ts`

import { PrismaClient, Prisma, BookingStatus } from "@prisma/client";

const db = new PrismaClient();

/** Anchor each date at 12:00 UTC, then add N days — avoids TZ edge bugs. */
function dayN(n: number): Date {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

/** Decimal helper for money columns. */
const dec = (v: string) => new Prisma.Decimal(v);

/** Minimal fake identity for seed data. */
function person(ix: number) {
  const names = [
    "Alex Costa",
    "Maria Silva",
    "João Ramos",
    "Ana Sousa",
    "Rita Marques",
    "Pedro Alves",
  ];
  const name = names[ix % names.length];
  const slug = name.toLowerCase().replace(/\s+/g, ".");
  return {
    name,
    email: `${slug}+seed${ix}@example.com`,
    phone: `+351 9${(ix % 9) + 10} ${100000 + ix}`,
  };
}

/** Create one booking — ensures required fields; amounts kept precise. */
async function createBooking(
  machineId: number,
  ix: number,
  startOffset: number,
  endOffset: number,
  status: BookingStatus
) {
  const p = person(ix);
  const startDate = dayN(startOffset);
  const endDate = dayN(endOffset);

  // Days count for a quick total estimate (gross-ish with VAT baked for seed).
  const days = Math.max(
    1,
    Math.ceil((+endDate - +startDate) / (1000 * 60 * 60 * 24))
  );
  const base = 150 + (machineId % 3) * 50;
  const total = dec((base * days * 1.23).toFixed(2));

  return db.booking.create({
    data: {
      machineId,
      startDate,
      endDate,
      status,
      customerName: p.name,
      customerEmail: p.email,
      customerPhone: p.phone,
      totalCost: total,
      // Note in schema: depositPaid reused to mean "fully paid" after pivot.
      depositPaid: status === BookingStatus.CONFIRMED,
      stripePaymentIntentId: null,
      customerNIF: "123456789",
      insuranceSelected: true,
      deliverySelected: true,
      pickupSelected: true,

      billingAddressLine1: "Rua das Flores 123",
      billingCity: "Portimão",
      billingCompanyName: null,
      billingCountry: "PT",
      billingIsBusiness: false,
      billingPostalCode: "8500-000",
      billingTaxId: null,

      operatorSelected: false,

      siteAddressCity: "Portimão",
      siteAddressLine1: "Obra do Cliente, Lote 5",
      siteAddressNotes: "Acesso por trás do armazém",
      siteAddressPostalCode: "8500-001",

      refundStatus: "NONE",
      refundedAmountCents: 0,
      refundIds: [],
      disputeStatus: "NONE",
      disputeId: null,
      disputeReason: null,
      disputeClosedAt: null,

      stripeChargeId: null,

      invoiceProvider: null,
      invoiceProviderId: null,
      invoiceNumber: null,
      invoicePdfUrl: null,
      invoiceAtcud: null,
    },
  });
}

/** Upsert machine by unique name. */
async function upsertMachine(data: {
  name: string;
  description: string;
  imageUrl: string;
  referenceUrl?: string | null;
  dailyRate: Prisma.Decimal;
  weight: string;
  deposit: Prisma.Decimal;
  deliveryCharge?: Prisma.Decimal | null;
  minDays?: number;
  pickupCharge?: Prisma.Decimal | null;
  category?: string;
  model?: string | null;
}) {
  return db.machine.upsert({
    where: { name: data.name },
    update: { ...data },
    create: { ...data },
  });
}

async function main() {
  console.log("Seeding catalog…");

  // 1) Small, realistic catalog
  const machines = await Promise.all([
    upsertMachine({
      name: "Mini-Excavator 2.7T",
      description: "Compact excavator ideal for tight access works.",
      imageUrl: "/images/machines/mini-excavator-27t.jpg",
      referenceUrl: null,
      dailyRate: dec("150.00"),
      weight: "2.7T",
      deposit: dec("500.00"),
      deliveryCharge: dec("45.00"),
      minDays: 1,
      pickupCharge: dec("45.00"),
      category: "Excavators",
      model: "Bobcat E27",
    }),
    upsertMachine({
      name: "Skid Steer Loader",
      description: "Versatile loader for site clearing and material handling.",
      imageUrl: "/images/machines/skid-steer.jpg",
      referenceUrl: null,
      dailyRate: dec("180.00"),
      weight: "3.0T",
      deposit: dec("600.00"),
      deliveryCharge: dec("50.00"),
      minDays: 1,
      pickupCharge: dec("50.00"),
      category: "Loaders",
      model: "CAT 226D3",
    }),
    upsertMachine({
      name: "Plate Compactor",
      description: "Soil compaction for paving and trench backfill.",
      imageUrl: "/images/machines/plate-compactor.jpg",
      referenceUrl: null,
      dailyRate: dec("60.00"),
      weight: "90kg",
      deposit: dec("200.00"),
      deliveryCharge: dec("25.00"),
      minDays: 1,
      pickupCharge: dec("25.00"),
      category: "Compaction",
      model: "Wacker Neuson WP1550",
    }),
  ]);

  const byName = new Map(machines.map((m) => [m.name, m.id]));
  const seededMachineIds = machines.map((m) => m.id);

  // 2) Safe cleanup — only remove our previous seeds for these machines
  //    (identified by '+seed' in email) to avoid touching real data.
  console.log("Cleaning previous seed data for these machines only…");
  await db.booking.deleteMany({
    where: {
      machineId: { in: seededMachineIds },
      customerEmail: { contains: "+seed" },
    },
  });

  console.log("Creating non-overlapping bookings per machine…");

  const tasks: Promise<unknown>[] = [];

  // ——— IMPORTANT: No overlaps per machine. Keep ≥1-day gaps because your tsrange is '[]' inclusive. ———

  // Mini-Excavator 2.7T — inside window, spaced bookings
  {
    const id = byName.get("Mini-Excavator 2.7T")!;
    tasks.push(createBooking(id, 1, 2, 5, BookingStatus.CONFIRMED)); // 2→5
    tasks.push(createBooking(id, 2, 7, 9, BookingStatus.PENDING));   // 7→9 (gap day 6)
    tasks.push(createBooking(id, 3, 12, 15, BookingStatus.CONFIRMED)); // 12→15 (gap 10–11)
    tasks.push(createBooking(id, 4, 20, 24, BookingStatus.CONFIRMED)); // 20→24 (gap 16–19)
  }

  // Skid Steer Loader — includes an end-edge overlap with the 30d window (29→33),
  // but still no overlaps within this machine.
  {
    const id = byName.get("Skid Steer Loader")!;
    tasks.push(createBooking(id, 5, 1, 2, BookingStatus.CONFIRMED));    // 1→2
    tasks.push(createBooking(id, 6, 10, 13, BookingStatus.CONFIRMED));  // 10→13 (gap 3–9)
    tasks.push(createBooking(id, 7, 29, 33, BookingStatus.CONFIRMED));  // 29→33 (overlaps window end boundary only)
  }

  // Plate Compactor — includes a start-edge overlap (-2→1)
  {
    const id = byName.get("Plate Compactor")!;
    tasks.push(createBooking(id, 8, -2, 1, BookingStatus.CONFIRMED));   // -2→1 (overlaps window start boundary only)
    tasks.push(createBooking(id, 9, 3, 3, BookingStatus.CONFIRMED));    // 3→3 (single day; gap day 2)
    tasks.push(createBooking(id, 10, 14, 16, BookingStatus.PENDING));   // 14→16 (gap 4–13)
  }

  await Promise.all(tasks);

  console.log("✅ Staging seed complete (non-overlapping per machine).");
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error("❌ Seed failed:", e);
    await db.$disconnect();
    process.exit(1);
  });
