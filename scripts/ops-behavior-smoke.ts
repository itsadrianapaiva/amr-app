/**
 * Dev-only smoke tests for Ops/Customer booking behavior.
 *
 * Usage:
 *   # 1) Blank DB check (deletes ALL bookings)
 *   npx tsx scripts/ops-behavior-smoke.ts --blank
 *
 *   # 2) Seed and validate overlap rules
 *   npx tsx scripts/ops-behavior-smoke.ts --seed
 *
 *   # 3) Dump raw rows + disabled ranges for a machine (after using the UI)
 *   npx tsx scripts/ops-behavior-smoke.ts --machine 8 --dump
 *  npm run db:clean - for shortcut
 */

import { db } from "@/lib/db";
import { getDisabledRangesByMachine } from "@/lib/availability.server";

function ymdToUtcDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

// Pretty-print helpers (Lisbon and UTC)
const LISBON_TZ = "Europe/Lisbon";
function fmtInTz(date: Date, tz: string) {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "??";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get(
    "minute"
  )}:${get("second")}`;
}
function ymdInLisbon(d: Date) {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: LISBON_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return dtf.format(d);
}

async function blankDb(): Promise<void> {
  console.log("⚠️  Deleting ALL bookings in this database…");
  const deleted = await db.booking.deleteMany({});
  console.log(`• Deleted rows: ${deleted.count}`);
  const disabled = await getDisabledRangesByMachine();
  console.log("• Disabled ranges by machine (should be empty):");
  console.dir(disabled, { depth: null });
}

async function seedAndProbe(): Promise<void> {
  const mid = 1;
  const mk = async (from: string, to: string) => {
    const created = await db.booking.create({
      data: {
        machineId: mid,
        status: "CONFIRMED",
        startDate: ymdToUtcDate(from),
        endDate: ymdToUtcDate(to),
        customerName: "SMOKE",
        customerEmail: "smoke@test",
        customerPhone: "000",
        siteAddressLine1: "NA",
        totalCost: 0,
        depositPaid: false,
        stripePaymentIntentId: null,
      },
      select: { id: true },
    });
    console.log(`• Created booking #${created.id} [${from} → ${to}]`);
  };

  console.log("🔄 Resetting only bookings table…");
  await db.booking.deleteMany({});

  console.log("➕ Seeding:");
  await mk("2025-09-01", "2025-09-03");
  await mk("2025-09-05", "2025-09-06");

  console.log("\n🔍 Disabled ranges (merged) for all machines:");
  const disabled = await getDisabledRangesByMachine();
  console.dir(disabled, { depth: null });

  async function overlaps(startYmd: string, endYmd: string): Promise<boolean> {
    const start = ymdToUtcDate(startYmd);
    const end = ymdToUtcDate(endYmd);
    const hit = await db.booking.findFirst({
      where: {
        machineId: mid,
        status: "CONFIRMED",
        startDate: { lte: end },
        endDate: { gte: start },
      },
      select: { id: true },
    });
    return Boolean(hit);
  }

  console.log("\n✅ Expect OVERLAP (touch end): 2025-09-03 → 2025-09-05");
  console.log("Result:", await overlaps("2025-09-03", "2025-09-05"));

  console.log("\n✅ Expect NO OVERLAP (gap): 2025-09-04 → 2025-09-04");
  console.log("Result:", await overlaps("2025-09-04", "2025-09-04"));

  console.log("\n✅ Expect OVERLAP (inside second): 2025-09-06 → 2025-09-06");
  console.log("Result:", await overlaps("2025-09-06", "2025-09-06"));
}

async function dumpMachine(mid: number): Promise<void> {
  console.log(`\n📄 Raw rows for machine ${mid} (last 10):`);
  const rows = await db.booking.findMany({
    where: { machineId: mid },
    orderBy: [{ startDate: "asc" }, { id: "asc" }],
    take: 10,
    select: {
      id: true,
      status: true,
      startDate: true,
      endDate: true,
    },
  });

  if (!rows.length) {
    console.log("  (none)");
  } else {
    for (const r of rows) {
      console.log(
        [
          `#${r.id} ${r.status}`,
          `UTC   : ${r.startDate.toISOString()} → ${r.endDate.toISOString()}`,
          `Lisbon: ${fmtInTz(r.startDate, LISBON_TZ)} → ${fmtInTz(
            r.endDate,
            LISBON_TZ
          )}`,
          `Days  : ${ymdInLisbon(r.startDate)} → ${ymdInLisbon(
            r.endDate
          )} (inclusive?)`,
        ].join("\n")
      );
      console.log("—".repeat(60));
    }
  }

  console.log("\n🧮 Disabled ranges (server) for this machine:");
  const disabled = await getDisabledRangesByMachine();
  const forMachine = (disabled as Record<string, any[]>)[String(mid)] ?? [];
  console.dir(forMachine, { depth: null });
}

// Entry
(async () => {
  const args = new Set(process.argv.slice(2));
  const midFlagIndex = process.argv.indexOf("--machine");
  const mid =
    midFlagIndex > -1 ? Number(process.argv[midFlagIndex + 1]) : undefined;

  if (args.has("--blank")) {
    await blankDb();
  } else if (args.has("--seed")) {
    await seedAndProbe();
  } else if (args.has("--dump") && mid) {
    await dumpMachine(mid);
  } else {
    console.log("Usage:");
    console.log(
      "  --blank                   Delete all bookings and print disabled ranges"
    );
    console.log(
      "  --seed                    Seed known cases and validate overlap checks"
    );
    console.log(
      "  --machine <id> --dump     Dump rows + disabled ranges for one machine"
    );
  }
  process.exit(0);
})();
