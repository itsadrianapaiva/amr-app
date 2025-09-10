/**
 * Usage:
 *   npx ts-node scripts/ops-detect-overlap.ts --mid 2 --from 2025-09-18 --to 2025-09-19
 *
 * Reads overlaps for status in (PENDING, CONFIRMED) and shows hold expiry if any.
 * Pure read-only. Keeps logic identical to DB guard: [start, end] inclusive overlap.
 */
import { db } from "@/lib/db";

type Args = { mid: number; from: Date; to: Date };

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const find = (k: string) =>
    argv.find((a) => a === `--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : undefined;

  const midStr = find("mid");
  const fromStr = find("from");
  const toStr = find("to");

  if (!midStr || !fromStr || !toStr) {
    console.error(
      "Usage: npx ts-node scripts/ops-detect-overlap.ts --mid <machineId> --from YYYY-MM-DD --to YYYY-MM-DD"
    );
    process.exit(1);
  }

  const mid = Number(midStr);
  const from = new Date(`${fromStr}T00:00:00.000Z`);
  const to = new Date(`${toStr}T00:00:00.000Z`);

  if (!Number.isFinite(mid) || isNaN(from.getTime()) || isNaN(to.getTime())) {
    console.error("Invalid arguments. Check --mid, --from, --to.");
    process.exit(1);
  }

  return { mid, from, to };
}

async function main() {
  const { mid, from, to } = parseArgs();

  const rows = await db.booking.findMany({
    where: {
      machineId: mid,
      status: { in: ["PENDING", "CONFIRMED"] },
      startDate: { lte: to },
      endDate: { gte: from },
    },
    orderBy: [{ status: "desc" }, { id: "desc" }],
    select: {
      id: true,
      status: true,
      startDate: true,
      endDate: true,
      holdExpiresAt: true,
      customerEmail: true,
      stripePaymentIntentId: true,
    },
  });

  if (rows.length === 0) {
    console.log("No ACTIVE overlaps found.");
    return;
  }

  console.log(`Found ${rows.length} ACTIVE overlap(s):`);
  for (const r of rows) {
    const span = `[${r.startDate.toISOString().slice(0, 10)} → ${r.endDate
      .toISOString()
      .slice(0, 10)}]`;
    const hold =
      r.status === "PENDING" && r.holdExpiresAt
        ? ` (hold until ${r.holdExpiresAt.toISOString()})`
        : "";
    const who = r.customerEmail || "unknown";
    console.log(`- #${r.id} ${r.status} ${span} by ${who}${hold}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    // Ensure Prisma disconnects the pool.
    await db.$disconnect();
  });
