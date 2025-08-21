// seed directly from CSV file
import { PrismaClient, Prisma } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";

const prisma = new PrismaClient();

//HELPERS: parsing and header normalization

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

// Header mapping from CSV to our model fields
const HEADER_MAP: Record<string, keyof Prisma.MachineCreateInput> = {
  [norm("Deposits")]: "deposit",
  [norm("Type")]: "type",
  [norm("Name")]: "name",
  [norm("Weight")]: "weight",
  [norm("Delivery charge")]: "deliveryCharge",
  [norm("Pick up charge")]: "pickupCharge",
  [norm("Day minimum")]: "minDays",
  [norm("Price per day")]: "dailyRate",
  [norm("Image")]: "imageUrl",
  [norm("Description")]: "description",
};

// SAFE IDENTITY RESET WITHOUT TRUNCATE
async function resetIdentitiesSafely() {
  // Delete children first to respect FKs
  await prisma.booking.deleteMany();
  await prisma.machine.deleteMany();

  // Reset sequences using setval. This does not need TRUNCATE privileges.
  // Next inserted row will get id=1 (because is_called=false).
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

//LOAD AND TRANSFORM CSV

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

    const required = ["name", "type", "dailyRate", "deposit"] as const;
    const missing = required.filter(
      (k) => !(k in normalized) || normalized[k] === undefined
    );
    if (missing.length) {
      console.warn(
        `Skipping CSV row ${rowNo} (${
          normalized.name ?? "unnamed"
        }) — missing: ${missing.join(", ")}`
      );
      return;
    }

    if (!("weight" in normalized)) normalized.weight = "";
    if (!("description" in normalized)) normalized.description = "";
    if (!("imageUrl" in normalized)) normalized.imageUrl = "";

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
      update: data,
      create: data,
    });
    console.log(
      `Upserted: ${machine.name} | type=${machine.type} | minDays=${machine.minDays} | ` +
        `dailyRate=${machine.dailyRate} | deposit=${machine.deposit} | ` +
        `delivery=${machine.deliveryCharge ?? "null"} | pickup=${
          machine.pickupCharge ?? "null"
        }`
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
