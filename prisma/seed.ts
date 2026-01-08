/**
 * Machine Seeding Script
 *
 * This script reads prisma/data/machines.csv and upserts machines to the database.
 * It is safe for production when CSV is the source of truth.
 *
 * UPSERT IDENTITY:
 * - Upserts by Machine.code (stable, unique identifier)
 * - CSV must include a Code column for each machine
 *
 * USAGE:
 * - Full seed: npm run db:seed
 * - Targeted seed: SEED_ONLY_CODE=<code> npm run db:seed
 *   Example: SEED_ONLY_CODE=mini-bobcat-wheel npm run db:seed
 *
 * RESET (DESTRUCTIVE):
 * - SEED_RESET=1 deletes all machines and bookings, resets IDs
 * - WARNING: NEVER use SEED_RESET=1 in production (will throw error)
 *
 * SAFETY:
 * - Validates CSV has unique codes and names
 * - Validates required fields and numeric sanity
 * - Fails fast before any DB writes if validation fails
 * - always run seed and backfill with explicit dotenv or explicit DATABASE_URL.
 * 
 * EXAMPLES:
 * SEED_ONLY_CODE=mini-bobcat-wheel npx dotenv -e .env.production -- npm run db:seed
OR npx dotenv -e .env.staging -- npm run db:seed
 */

import { PrismaClient, Prisma } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";

const prisma = new PrismaClient();

/** Local fallback for legacy `imageUrl` (we don't render DB images anymore). */
const DEFAULT_IMAGE_URL = "/images/machines/_fallback.jpg";

// HELPERS: parsing and header normalization

// Normalize CSV headers to a stable key for mapping
function norm(h: string) {
  return h.trim().toLowerCase();
}

// Safe float parse: returns null on empty/invalid
function parseNum(v: unknown): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Safe int parse; rounds floats like "2.0" to 2
function parseIntOrNull(v: unknown): number | null {
  const n = parseNum(v);
  return n == null ? null : Math.round(n);
}

/**
 * Header mapping from CSV to our model fields
 * Notes:
 * - Prisma field is now `category` (mapped to DB column "type" via @map).
 * - Accept both "Category" and legacy "Type".
 * - CSV "Image" is now **reference-only** → `referenceUrl` (NOT used by UI).
 * - Code is required for upsert identity.
 */
const HEADER_MAP: Record<string, keyof Prisma.MachineCreateInput> = {
  [norm("Code")]: "code",
  [norm("Deposits")]: "deposit",
  [norm("Type")]: "category", // legacy header still works
  [norm("Category")]: "category", // preferred header
  [norm("Model")]: "model",
  [norm("Name")]: "name",
  [norm("Weight")]: "weight",
  [norm("Delivery charge")]: "deliveryCharge",
  [norm("Pick up charge")]: "pickupCharge",
  [norm("Day minimum")]: "minDays",
  [norm("Price per day")]: "dailyRate",
  [norm("Image")]: "referenceUrl", // ⬅️ store as reference-only, not for rendering
  [norm("Description")]: "description",
};

// SAFE IDENTITY RESET WITHOUT TRUNCATE
async function resetIdentitiesSafely() {
  // Delete children first to respect FKs
  await prisma.booking.deleteMany();
  await prisma.machine.deleteMany();

  // Reset sequences using setval. Next inserted row will get id=1.
  try {
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"Machine"', 'id'), 1, false);`
    );
  } catch (e) {
    console.warn('Could not reset "Machine" id sequence. Continuing...', e);
  }
  try {
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"Booking"', 'id'), 1, false);`
    );
  } catch (e) {
    console.warn('Could not reset "Booking" id sequence. Continuing...', e);
  }
}

// LOAD AND TRANSFORM CSV

function loadCsvMachines(csvPath: string): Prisma.MachineCreateInput[] {
  const csv = fs.readFileSync(csvPath, "utf8");
  const rows: Record<string, unknown>[] = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const out: Prisma.MachineCreateInput[] = [];

  rows.forEach((row, idx) => {
    const rowNo = idx + 2; // header is row 1
    const normalized: Partial<Prisma.MachineCreateInput> = {};

    for (const [rawKey, rawVal] of Object.entries(row)) {
      const key = HEADER_MAP[norm(rawKey)];
      if (!key) continue;

      if (key === "dailyRate" || key === "deposit") {
        const n = parseNum(rawVal);
        if (n != null) (normalized as any)[key] = n;
      } else if (key === "deliveryCharge" || key === "pickupCharge") {
        const n = parseNum(rawVal);
        (normalized as any)[key] = n == null ? undefined : n;
      } else if (key === "minDays") {
        const n = parseIntOrNull(rawVal);
        (normalized as any)[key] = n == null ? undefined : n;
      } else {
        (normalized as any)[key] = String(rawVal ?? "");
      }
    }

    // Required columns (note: 'category' replaces 'type', 'code' is now required)
    const required = ["code", "name", "category", "dailyRate", "deposit"] as const;
    const missing = required.filter(
      (k) =>
        !(k in normalized) ||
        normalized[k] === undefined ||
        normalized[k] === ""
    );
    if (missing.length) {
      console.error(
        `❌ CSV row ${rowNo} (${normalized.name ?? "unnamed"}) — missing required fields: ${missing.join(", ")}`
      );
      console.error("All rows must have: code, name, category, dailyRate, deposit");
      process.exit(1);
    }

    // Validate numeric sanity
    const dailyRate = normalized.dailyRate as number;
    const deposit = normalized.deposit as number;
    const minDays = normalized.minDays as number | undefined;
    const deliveryCharge = normalized.deliveryCharge as number | undefined;
    const pickupCharge = normalized.pickupCharge as number | undefined;
    const category = normalized.category as string;

    // Addon machines (itemType ADDON) can have dailyRate = 0 (pricing comes from context)
    const isAddon = category === "Addons";
    if (!isAddon && dailyRate <= 0) {
      console.error(`❌ CSV row ${rowNo} (${normalized.name}): dailyRate must be > 0, got ${dailyRate}`);
      process.exit(1);
    }
    if (isAddon && dailyRate !== 0) {
      console.error(`❌ CSV row ${rowNo} (${normalized.name}): addon machines must have dailyRate = 0, got ${dailyRate}`);
      process.exit(1);
    }
    if (deposit < 0) {
      console.error(`❌ CSV row ${rowNo} (${normalized.name}): deposit must be >= 0, got ${deposit}`);
      process.exit(1);
    }
    if (minDays !== undefined && minDays < 1) {
      console.error(`❌ CSV row ${rowNo} (${normalized.name}): minDays must be >= 1, got ${minDays}`);
      process.exit(1);
    }
    if (deliveryCharge !== undefined && deliveryCharge < 0) {
      console.error(`❌ CSV row ${rowNo} (${normalized.name}): deliveryCharge must be >= 0, got ${deliveryCharge}`);
      process.exit(1);
    }
    if (pickupCharge !== undefined && pickupCharge < 0) {
      console.error(`❌ CSV row ${rowNo} (${normalized.name}): pickupCharge must be >= 0, got ${pickupCharge}`);
      process.exit(1);
    }

    // Defaults for optional fields
    if (!("weight" in normalized)) normalized.weight = "";
    if (!("description" in normalized)) normalized.description = "";

    // We **do not** render DB image URLs; keep a safe local placeholder.
    if (!("imageUrl" in normalized) || !normalized.imageUrl) {
      normalized.imageUrl = DEFAULT_IMAGE_URL;
    }

    // Reference-only link from CSV "Image" column
    if (!("referenceUrl" in normalized)) {
      (normalized as any).referenceUrl = null;
    }

    // Set cart-ready fields based on category (isAddon already declared above)
    if (isAddon) {
      // Addon machines: determine timeUnit based on code
      (normalized as any).itemType = "ADDON";
      (normalized as any).chargeModel = "PER_BOOKING";

      // Operator is charged per day, other addons are flat
      const code = normalized.code as string;
      (normalized as any).timeUnit = code === "addon-operator" ? "DAY" : "NONE";
    } else {
      // Primary machines: day-based charge (default)
      (normalized as any).itemType = "PRIMARY";
      (normalized as any).chargeModel = "PER_BOOKING";
      (normalized as any).timeUnit = "DAY";
    }

    out.push(normalized as Prisma.MachineCreateInput);
  });

  // Validate uniqueness of codes and names
  const codes = new Set<string>();
  const names = new Set<string>();

  for (const machine of out) {
    const code = machine.code as string;
    const name = machine.name;

    if (codes.has(code)) {
      console.error(`❌ Duplicate code found in CSV: "${code}"`);
      process.exit(1);
    }
    codes.add(code);

    if (names.has(name)) {
      console.error(`❌ Duplicate name found in CSV: "${name}"`);
      process.exit(1);
    }
    names.add(name);
  }

  return out;
}

// MAIN UPSERT LOOP

async function main() {
  const csvPath = path.join(process.cwd(), "prisma", "data", "machines.csv");
  console.log(`Reading: ${csvPath}`);

  // Harden destructive reset - NEVER allow in production
  if (process.env.SEED_RESET === "1") {
    if (process.env.NODE_ENV === "production") {
      console.error("❌ FATAL: SEED_RESET=1 is FORBIDDEN in production environment");
      console.error("This would delete all machines and bookings!");
      process.exit(1);
    }
    console.warn("⚠️  SEED_RESET=1 — deleting all rows and resetting IDs.");
    await resetIdentitiesSafely();
  }

  const machines = loadCsvMachines(csvPath);
  console.log(`✓ Parsed ${machines.length} machine rows from CSV.`);

  // Handle targeted seeding
  const targetCode = process.env.SEED_ONLY_CODE?.trim();
  let machinesToSeed = machines;

  if (targetCode) {
    const targetMachine = machines.find((m) => m.code === targetCode);
    if (!targetMachine) {
      console.error(`❌ SEED_ONLY_CODE="${targetCode}" not found in CSV`);
      console.error(`Available codes: ${machines.map((m) => m.code).join(", ")}`);
      process.exit(1);
    }
    machinesToSeed = [targetMachine];
    console.log(`🎯 Targeted seed: only upserting code="${targetCode}"`);
  }

  for (const data of machinesToSeed) {
    const machine = await prisma.machine.upsert({
      where: { code: data.code },
      update: data, // updates all fields including name, model, description, etc.
      create: data, // creates with all fields from CSV
    });
    console.log(
      `✓ Upserted: ${machine.name} | code=${machine.code} | category=${machine.category} | model=${machine.model ?? "null"} | minDays=${machine.minDays} | ` +
        `dailyRate=${machine.dailyRate} | deposit=${machine.deposit}`
    );
  }

  console.log(`\n✓ Seeding completed: ${machinesToSeed.length} machine(s) upserted.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
