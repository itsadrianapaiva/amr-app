// seed directly from CSV file
// run with 'npm run db:seed'

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
 */
const HEADER_MAP: Record<string, keyof Prisma.MachineCreateInput> = {
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

    // Required columns (note: 'category' replaces 'type')
    const required = ["name", "category", "dailyRate", "deposit"] as const;
    const missing = required.filter(
      (k) =>
        !(k in normalized) ||
        normalized[k] === undefined ||
        normalized[k] === ""
    );
    if (missing.length) {
      console.warn(
        `Skipping CSV row ${rowNo} (${normalized.name ?? "unnamed"}) — missing: ${missing.join(", ")}`
      );
      return;
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

    out.push(normalized as Prisma.MachineCreateInput);
  });

  return out;
}

// MAIN UPSERT LOOP

async function main() {
  const csvPath = path.join(process.cwd(), "prisma", "data", "machines.csv");
  console.log(`Reading: ${csvPath}`);

  // Optional destructive reset for development
  if (process.env.SEED_RESET === "1") {
    console.warn("SEED_RESET=1 — deleting all rows and resetting IDs.");
    await resetIdentitiesSafely();
  }

  const machines = loadCsvMachines(csvPath);
  console.log(`Parsed ${machines.length} machine rows from CSV.`);

  for (const data of machines) {
    const machine = await prisma.machine.upsert({
      where: { name: data.name },
      update: data, // updates category/model/referenceUrl/etc.
      create: data, // creates with safe local imageUrl + optional referenceUrl
    });
    console.log(
      `Upserted: ${machine.name} | category=${machine.category} | model=${machine.model ?? "null"} | refURL=${machine.referenceUrl ?? "null"} | minDays=${machine.minDays} | ` +
        `dailyRate=${machine.dailyRate} | deposit=${machine.deposit}`
    );
  }

  console.log("Seeding completed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
