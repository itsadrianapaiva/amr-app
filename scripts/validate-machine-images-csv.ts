/**
 * Validation script: Verify all machine codes in CSV resolve to non-fallback images
 *
 * Run: npx tsx scripts/validate-machine-images-csv.ts
 *
 * This catches missing alias mappings before they reach production.
 * CSV-only version (no database dependency).
 */

import * as fs from "fs";
import * as path from "path";
import {
  MACHINE_IMAGE_ALIASES,
  CANONICAL_IMAGE_KEYS,
} from "@/lib/content/images/config";

// Normalize to slug format (same as resolveMachineImage)
function toSlugLike(s: string): string {
  return String(s || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Simplified version of getMachineImage logic (alias lookup only)
function canResolveImage(code: string): boolean {
  const normalized = toSlugLike(code);
  const canonical = MACHINE_IMAGE_ALIASES[normalized] ?? normalized;
  return CANONICAL_IMAGE_KEYS.includes(canonical);
}

function validateMachineImagesFromCsv() {
  console.log("🔍 Validating machine image resolution from CSV...\n");

  const csvPath = path.join(process.cwd(), "prisma", "data", "machines.csv");
  const csvContent = fs.readFileSync(csvPath, "utf-8");
  const lines = csvContent.split("\n").filter((line) => line.trim());

  // Skip header
  const dataLines = lines.slice(1);

  let failures = 0;
  let warnings = 0;
  let resolved = 0;
  let skipped = 0;

  for (const line of dataLines) {
    const fields = line.split(",");
    const code = fields[0]?.trim();
    const category = fields[2]?.trim();
    const name = fields[3]?.trim();

    if (!code) continue;

    // Skip addon machines (category = "Addons") - they're never displayed in UI
    if (category === "Addons") {
      skipped++;
      console.log(`⏭️  [${code}] → SKIPPED (addon machine, never displayed)`);
      continue;
    }

    const normalizedCode = toSlugLike(code);
    const canResolve = canResolveImage(code);

    if (!canResolve) {
      // Allow test/internal machines to use fallback
      if (code.includes("test") || name?.toLowerCase().includes("test")) {
        warnings++;
        console.warn(`⚠️  [${code}] → FALLBACK (test machine, OK)`);
      } else {
        failures++;
        console.error(
          `❌ [${code}] (normalized: ${normalizedCode}) → FALLBACK\n   Missing alias or canonical key for: "${name}"`
        );
      }
    } else {
      resolved++;
      const canonical = MACHINE_IMAGE_ALIASES[normalizedCode] ?? normalizedCode;
      console.log(`✅ [${code}] → ${canonical}`);
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Total machines: ${dataLines.length}`);
  console.log(`✅ Resolved: ${resolved}`);
  console.log(`⏭️  Skipped (addon machines): ${skipped}`);
  console.log(`⚠️  Warnings (test machines): ${warnings}`);
  console.log(`❌ Failures (missing mappings): ${failures}`);
  console.log(`${"=".repeat(60)}\n`);

  if (failures > 0) {
    console.error("🚨 VALIDATION FAILED: Some production machines have no image mapping.");
    console.error("   Add entries to MACHINE_IMAGE_ALIASES in lib/content/images.ts\n");
    process.exit(1);
  } else {
    console.log("✨ All production machines have valid image mappings!\n");
  }
}

validateMachineImagesFromCsv();
