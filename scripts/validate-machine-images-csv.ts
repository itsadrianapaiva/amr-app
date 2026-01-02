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

// Copy of the alias map from lib/content/images.ts
const MACHINE_IMAGE_ALIASES: Record<string, string> = {
  // old naming
  "mini-bobcat-with-wheels": "wheel-skid-steer-loader",

  // new naming (updated to match CSV codes)
  "mini-skid-steer-w-wheels": "wheel-skid-steer-loader",
  "mini-bobcat-wheel": "wheel-skid-steer-loader",
  "mini-excavator-jcb": "mini-excavator",
  "mini-excavator": "mini-excavator",
  "bobcat-t450-track": "skid-steer-loader-tracks",
  "medium-bobcat-skid-steer-w-tracks": "skid-steer-loader-tracks",
  "bobcat-t190-track": "lg-skid-steer-loader-tracks",
  "larger-bobcat-skid-steer-w-tracks": "lg-skid-steer-loader-tracks",
  "bobcat-e80-excavator": "medium-excavator",
  "medium-excavator": "medium-excavator",
  "jcb-85z1-excavator": "large-excavator",
  "large-excavator": "large-excavator",
  "bobcat-tl619-telehandler": "telehandler",
  telehandler: "telehandler",
  "crommelins-compactor": "compactor",
  compactor: "compactor",
  "concrete-mixer-200l": "cement-mixer",
  "200-liter-concrete-mixer": "cement-mixer",
  "vevor-post-hole-digger": "hole-boring-machine",
  "hole-boring-machine": "hole-boring-machine",
  "hyundai-petrol-powerwasher": "power-washer",
  "mercedes-tipper-3500": "mercedes-tipper",
  "isuzu-tipper-crane": "tipper-with-crane",
  "volvo-16m3-truck": "volvo-dump-truck",

  // legacy aliases (trucks & haulers)
  "3500-tipper-truck-with-driver": "mercedes-tipper",
  "3500-tipper-with-crane-and-driver": "tipper-with-crane",
  "16m3-truck-with-driver": "volvo-dump-truck",
};

// Canonical image keys that exist in the images map
const CANONICAL_IMAGE_KEYS = [
  "mini-excavator",
  "medium-excavator",
  "large-excavator",
  "skid-steer-loader-tracks",
  "lg-skid-steer-loader-tracks",
  "wheel-skid-steer-loader",
  "telehandler",
  "compactor",
  "cement-mixer",
  "power-washer",
  "hole-boring-machine",
  "mercedes-tipper",
  "tipper-with-crane",
  "volvo-dump-truck",
];

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

  for (const line of dataLines) {
    const fields = line.split(",");
    const code = fields[0]?.trim();
    const name = fields[3]?.trim();

    if (!code) continue;

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
