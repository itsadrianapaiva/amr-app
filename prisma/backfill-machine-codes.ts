/**
 * One-time backfill script to populate Machine.code from machines.csv
 *
 * This script:
 * - Reads prisma/data/machines.csv
 * - Maps machine names to codes from CSV
 * - Updates all DB machines that have null code
 * - Fails fast if any DB machine is not found in CSV
 * - Preserves all existing Machine.id values
 *
 * Run with: ts-node --project prisma/tsconfig.json prisma/backfill-machine-codes.ts
 */

import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";

const prisma = new PrismaClient();

// Normalize header for case-insensitive lookup
function norm(h: string): string {
  return h.trim().toLowerCase();
}

interface CsvRow {
  code: string;
  name: string;
}

/**
 * Load CSV and build name->code mapping
 */
function loadCsvMapping(csvPath: string): Map<string, string> {
  console.log(`Reading CSV: ${csvPath}`);

  const csv = fs.readFileSync(csvPath, "utf8");
  const rows: Record<string, unknown>[] = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`Parsed ${rows.length} rows from CSV`);

  const mapping = new Map<string, string>();
  const codes = new Set<string>();

  rows.forEach((row, idx) => {
    const rowNo = idx + 2; // header is row 1

    // Extract code and name
    let code: string | undefined;
    let name: string | undefined;

    for (const [rawKey, rawVal] of Object.entries(row)) {
      const key = norm(rawKey);
      if (key === "code") {
        code = String(rawVal ?? "").trim();
      } else if (key === "name") {
        name = String(rawVal ?? "").trim();
      }
    }

    // Validate required fields
    if (!code) {
      console.error(`❌ Row ${rowNo}: missing or empty Code`);
      process.exit(1);
    }
    if (!name) {
      console.error(`❌ Row ${rowNo}: missing or empty Name`);
      process.exit(1);
    }

    // Check for duplicate codes
    if (codes.has(code)) {
      console.error(
        `❌ Duplicate code found in CSV: "${code}" at row ${rowNo}`
      );
      process.exit(1);
    }
    codes.add(code);

    // Check for duplicate names (schema has name @unique)
    if (mapping.has(name)) {
      console.error(
        `❌ Duplicate name found in CSV: "${name}" at row ${rowNo}`
      );
      process.exit(1);
    }

    mapping.set(name, code);
  });

  console.log(`✓ Built mapping for ${mapping.size} machines`);
  return mapping;
}

/**
 * Validate that all DB machines with null code can be mapped
 */
function validateMapping(
  dbMachines: Array<{ id: number; name: string }>,
  mapping: Map<string, string>
): void {
  console.log("\nValidating DB machines against CSV...");

  const missingMachines: string[] = [];

  for (const machine of dbMachines) {
    if (!mapping.has(machine.name)) {
      missingMachines.push(machine.name);
    }
  }

  if (missingMachines.length > 0) {
    console.error(
      "\n❌ FAIL FAST: The following DB machines are not found in CSV:"
    );
    missingMachines.forEach((name) => console.error(`   - "${name}"`));
    console.error(
      "\nPlease add these machines to machines.csv with a Code, or remove them from the database."
    );
    process.exit(1);
  }

  console.log("✓ All DB machines can be mapped to CSV codes");
}

/**
 * Apply code updates to DB using raw SQL
 * (Prisma types expect code to be non-null, but DB has nulls during migration)
 */
async function applyUpdates(
  dbMachines: Array<{ id: number; name: string }>,
  mapping: Map<string, string>
): Promise<{ updated: number }> {
  console.log("\nApplying updates using raw SQL...");

  let updated = 0;

  for (const machine of dbMachines) {
    const code = mapping.get(machine.name);
    if (!code) {
      // This should never happen due to validation above
      console.error(`❌ Unexpected: no code for "${machine.name}"`);
      process.exit(1);
    }

    // Use raw SQL to update, guarded by code IS NULL to be idempotent
    const result = await prisma.$executeRaw`
      UPDATE "Machine"
      SET code = ${code}
      WHERE id = ${machine.id}
      AND code IS NULL
    `;

    if (result > 0) {
      console.log(
        `  ✓ Updated: ${machine.name} -> code="${code}" (id=${machine.id})`
      );
      updated++;
    } else {
      console.log(
        `  Skip: ${machine.name} (already has code, id=${machine.id})`
      );
    }
  }

  return { updated };
}

/**
 * Final verification: ensure all machines have non-null code using raw SQL
 */
async function verifyAllCodesSet(): Promise<void> {
  console.log("\nVerifying all machines have code...");

  // Use raw SQL to count machines with null or empty code
  const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count
    FROM "Machine"
    WHERE code IS NULL OR code = ''
  `;

  const nullCount = Number(result[0]?.count ?? 0);

  if (nullCount > 0) {
    console.error(
      `❌ VERIFICATION FAILED: ${nullCount} machines still have missing code`
    );

    // Fetch the actual missing machines for display
    const missing = await prisma.$queryRaw<Array<{ id: number; name: string }>>`
      SELECT id, name
      FROM "Machine"
      WHERE code IS NULL OR code = ''
      ORDER BY id
    `;

    missing.forEach((m) => console.error(`   - id=${m.id} name="${m.name}"`));
    process.exit(1);
  }

  console.log("✓ All machines have non-null code");
}

async function main() {
  console.log("=== Machine Code Backfill Script ===\n");

  const csvPath = path.join(process.cwd(), "prisma", "data", "machines.csv");

  // Step 1: Load CSV and build mapping
  const mapping = loadCsvMapping(csvPath);

  // Step 2: Fetch machines with null code using raw SQL
  console.log("\nFetching machines with null code from database...");
  const dbMachines = await prisma.$queryRaw<Array<{ id: number; name: string }>>`
    SELECT id, name
    FROM "Machine"
    WHERE code IS NULL
    ORDER BY id
  `;
  console.log(`✓ Found ${dbMachines.length} machines with null code`);

  if (dbMachines.length === 0) {
    console.log("\n✓ No machines need backfilling - all machines already have codes");
    return;
  }

  // Step 3: Validate mapping
  validateMapping(dbMachines, mapping);

  // Step 4: Apply updates
  const { updated } = await applyUpdates(dbMachines, mapping);

  // Step 5: Verify all codes are set
  await verifyAllCodesSet();

  // Summary
  console.log("\n=== Backfill Complete ===");
  console.log(`  Updated: ${updated}`);
  console.log(`  Machines processed: ${dbMachines.length}`);
  console.log("\n✓ All machines now have stable codes");
}

main()
  .catch((error) => {
    console.error("\n❌ Backfill failed with error:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
