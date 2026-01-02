/**
 * Validation script: Verify all machine codes resolve to non-fallback images
 *
 * Run: npx tsx scripts/validate-machine-images.ts
 *
 * This catches missing alias mappings before they reach production.
 */

import { db } from "@/lib/db";

// Copy of the alias map from lib/content/images.ts
const MACHINE_IMAGE_ALIASES: Record<string, string> = {
  // old naming
  "mini-bobcat-with-wheels": "wheel-skid-steer-loader",

  // new naming
  "mini-skid-steer-w-wheels": "wheel-skid-steer-loader",
  "mini-bobcat-wheel": "wheel-skid-steer-loader",
  "mini-excavator": "mini-excavator",
  "medium-bobcat-skid-steer-w-tracks": "skid-steer-loader-tracks",
  "larger-bobcat-skid-steer-w-tracks": "lg-skid-steer-loader-tracks",
  "medium-excavator": "medium-excavator",
  "large-excavator": "large-excavator",
  telehandler: "telehandler",
  compactor: "compactor",
  "200-liter-concrete-mixer": "cement-mixer",
  "hyundai-petrol-powerwasher": "power-washer",
  "hole-boring-machine": "hole-boring-machine",

  // trucks & haulers
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

async function validateMachineImages() {
  console.log("🔍 Validating machine image resolution...\n");

  const machines = await db.machine.findMany({
    select: { id: true, code: true, name: true },
    orderBy: { code: "asc" },
  });

  let failures = 0;
  let warnings = 0;

  for (const machine of machines) {
    const normalizedCode = toSlugLike(machine.code);
    const canResolve = canResolveImage(machine.code);

    if (!canResolve) {
      // Allow test/internal machines to use fallback
      if (machine.code.includes("test") || machine.name.toLowerCase().includes("test")) {
        warnings++;
        console.warn(
          `⚠️  [${machine.code}] → FALLBACK (test machine, OK)`
        );
      } else {
        failures++;
        console.error(
          `❌ [${machine.code}] (normalized: ${normalizedCode}) → FALLBACK\n   Missing alias or canonical key for: "${machine.name}"`
        );
      }
    } else {
      const canonical = MACHINE_IMAGE_ALIASES[normalizedCode] ?? normalizedCode;
      console.log(`✅ [${machine.code}] → ${canonical}`);
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Total machines: ${machines.length}`);
  console.log(`✅ Resolved: ${machines.length - failures - warnings}`);
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

validateMachineImages()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => {
    db.$disconnect();
  });
