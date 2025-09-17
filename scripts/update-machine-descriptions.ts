/**
 * Update machine descriptions from a CSV (conversion-focused copy).
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." npx tsx scripts/update-machine-descriptions.ts prisma/data/machines.csv --dry
 *   DATABASE_URL="postgresql://..." npx tsx scripts/update-machine-descriptions.ts prisma/data/machines.csv
 *
 * Notes:
 * - Matches rows by unique `name` field (assumes `Machine.name` is UNIQUE).
 * - Only updates `description`.
 * - `--dry` prints what would change without writing to DB.
 */

import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { PrismaClient } from "@prisma/client";

type Row = Record<string, string>;

function assert(a: unknown, msg: string): asserts a {
  if (!a) throw new Error(msg);
}

function normalizeHeader(h: string) {
  return h.trim().toLowerCase();
}

function pick<T extends object, K extends keyof T>(obj: T, key: K) {
  return obj[key];
}

async function main() {
  const [, , csvPathArg, maybeDry] = process.argv;
  assert(csvPathArg, "Path to CSV is required.");

  const dryRun = maybeDry === "--dry";

  const csvPath = path.resolve(csvPathArg);
  assert(fs.existsSync(csvPath), `CSV not found at ${csvPath}`);

  const buf = fs.readFileSync(csvPath);
  const records = parse(buf, {
    columns: (headers: string[]) => headers.map(normalizeHeader),
    skip_empty_lines: true,
    trim: true,
  }) as Row[];

  // Expect at least these headers
  const sample = records[0] || {};
  const hasName = "name" in sample;
  const hasDesc = "description" in sample;
  assert(hasName && hasDesc, "CSV must include 'Name' and 'Description' columns.");

  const updates = records
    .map((r) => ({
      name: r["name"]?.trim(),
      description: r["description"]?.trim(),
    }))
    .filter((r) => r.name && typeof r.description === "string");

  console.log(
    `Loaded ${records.length} rows, ${updates.length} candidate updates from: ${path.relative(
      process.cwd(),
      csvPath
    )}`
  );

  const prisma = new PrismaClient();
  let changed = 0;
  let skipped = 0;

  for (const u of updates) {
    const existing = await prisma.machine.findUnique({
      where: { name: u.name! },
      select: { id: true, name: true, description: true },
    });

    if (!existing) {
      skipped++;
      console.warn(`SKIP (not found by name): ${u.name}`);
      continue;
    }

    const next = (u.description || "").trim();
    const prev = (existing.description || "").trim();

    if (!next || next === prev) {
      skipped++;
      console.log(`NO-OP: ${u.name}`);
      continue;
    }

    console.log(`UPDATE: ${u.name}\n  from: ${prev || "(empty)"}\n  to  : ${next}\n`);

    if (!dryRun) {
      await prisma.machine.update({
        where: { id: existing.id },
        data: { description: next },
      });
      changed++;
    }
  }

  await prisma.$disconnect();
  console.log(
    `${dryRun ? "Dry-run" : "Done"} — changed=${changed}, skipped=${skipped}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
