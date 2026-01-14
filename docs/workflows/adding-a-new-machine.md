# Adding a New Machine

Step-by-step guide for adding a new machine to the rental inventory.

---

## Overview

Machines are defined in a CSV file and seeded into the database via Prisma. The CSV is the source of truth for machine data.

**Source of Truth:** [prisma/data/machines.csv](../../prisma/data/machines.csv)

**Seeding Script:** [prisma/seed.ts](../../prisma/seed.ts)

Deploying code does not modify machine data. All machine changes require running the seed script.

---

## Prerequisites

- Access to repository
- Node.js environment with dependencies installed
- Database access (local or staging)

---

## Step-by-Step Process

### 1. Add Machine to CSV

**File:** `prisma/data/machines.csv`

Add a new row with the following columns (in order):

| Column              | Required | Description                                    | Example                       |
| ------------------- | -------- | ---------------------------------------------- | ----------------------------- |
| **Code**            | Yes      | Unique machine identifier (stable, unchanging) | `MINI-DUMPER-500`             |
| **Deposits**        | Yes      | Deposit amount in EUR                          | `100.00`                      |
| **Category**        | Yes      | Machine category (see approved list below)     | `Trucks and Haulers`          |
| **Name**            | Yes      | Display name                                   | `Mini Dumper 500kg`           |
| **Model**           | No       | Model/spec info                                | `Yanmar C12R`                 |
| **Weight**          | No       | Machine weight                                 | `450kg`                       |
| **Size Rank**       | No       | Catalog ordering (10-99, lower=smaller)        | `20`                          |
| **Delivery charge** | No       | Delivery fee in EUR                            | `50.00`                       |
| **Pick up charge**  | No       | Pickup fee in EUR                              | `50.00`                       |
| **Day minimum**     | No       | Minimum rental days (>=1 if set)               | `1`                           |
| **Price per day**   | Yes      | Daily rate in EUR (must be >0)                 | `35.00`                       |
| **Image**           | No       | Reference URL only (NOT rendered in UI)        | `https://example.com/ref.jpg` |
| **Description**     | No       | Machine description                            | `Compact tracked dumper...`   |

**Size Rank Convention:**
- 10 = Micro/Ultra-compact
- 20 = Mini/Compact
- 30 = Medium
- 40 = Large
- 50+ = Extra Large/Heavy
- 99 = Default (unranked, sorts last - used for addons)

Machines within each category are displayed in order from small to large based on Size Rank.

**Approved Categories:**

Categories are defined in [lib/content/machine-categories.ts](../../lib/content/machine-categories.ts) as the single source of truth. Use these display labels in your CSV:

- **Skid Steer Loaders** (aliases: "Skid Steer", "Bobcat", "Skid Steer with Tracks")
- **Excavators** (aliases: "Excavator", "Medium Excavator", "Large Excavator")
- **Mini Excavators** (alias: "Mini Excavator")
- **Telehandlers** (alias: "Telehandler")
- **Compactors** (aliases: "Compactor", "Rammer", "Rammers")
- **Plate Compactors** (alias: "Plate Compactor")
- **Concrete Mixers** (aliases: "Concrete Mixer", "Mixer", "Mixers")
- **Power Washers** (aliases: "Power Washer", "Powerwasher", "Powerwashers", "Pressure Washer", "Pressure Washers")
- **Hole Boring Machines** (aliases: "Hole Boring Machine", "Holeboringmachine")
- **Trucks and Haulers** (aliases: "Trucks", "Truck", "Haulers", "Hauler", "Trucksandhaulers")
- **Addons** (for service and equipment addons)
- **Uncategorized** (fallback)

You can use either the display label or any alias - the system normalizes them automatically. If you need to add a new category, edit `lib/content/machine-categories.ts`.

**Example CSV row:**

```csv
MINI-DUMPER-500,100.00,Trucks and Haulers,Mini Dumper 500kg,Yanmar C12R,450kg,20,50.00,50.00,1,35.00,https://example.com/ref.jpg,Compact tracked dumper for narrow spaces
```

### 2. Validation Rules

The seed script validates:

**Required Fields:**

- `code` - Must be unique across all machines
- `name` - Cannot be empty
- `category` - Must be a known category (see approved list above)
- `dailyRate` (Price per day) - Must be >0
- `deposit` (Deposits) - Must be >=0

**Optional but Validated:**

- `minDays` (Day minimum) - If set, must be >=1
- All numeric fields must parse correctly

**Non-Blocking Warnings:**

The seed script will warn (but not fail) if:
- A PRIMARY machine has `sizeRank` missing or defaulted to 99
- A PRIMARY machine has an unknown/unrecognized category label

These warnings help catch data quality issues early. Fix them by updating the CSV and re-running the seed.

**Failure:** Script exits with error only if required validations fail

### 3. Run the Seeding Script

**Seed all machines:**

```bash
npm run db:seed
```

**Seed only the new machine (faster):**

```bash
SEED_ONLY_CODE=MINI-DUMPER-500 npm run db:seed
```

**Expected Output:**

```
Seeding machines...
  ✓ Upserted machine: MINI-DUMPER-500
```

### 3A. Running the Seed Script in Production (IMPORTANT)

Deploying code **does not update machine data** in production.

If you change **name, description, category, model, pricing, or min days**
in `machines.csv`, you **must run the seed script against the production database**.

#### Safety Rules

- Production seeding is **UPSERT ONLY**
- Machines are matched by `code`
- Existing bookings are **not affected**
- `SEED_RESET=1` is **hard-blocked** in production

#### Required Setup

Before running the seed in production:

- Ensure `.env.production` is present
- Never run from CI or Netlify build

#### Recommended: Targeted Production Seed

Use this when updating a single machine:

```bash
SEED_ONLY_CODE=<machine-code> npx dotenv -e .env.production -- npm run db:seed
```

Example:

```bash
SEED_ONLY_CODE=mini-bobcat-wheel npx dotenv -e .env.production -- npm run db:seed
```

This will:

- Update name, description, model, category, and pricing
- Create the machine if it does not exist
- Leave all other machines untouched

**Full Production Seed (Use with Caution):**

Only run this if the CSV is fully trusted as the source of truth:

```bash
npx dotenv -e .env.production -- npm run db:seed
```

### 4. Verify in Database (staging and production)

**Using Prisma Studio:**

```bash
npx dotenv -e .env.staging -- npx prisma studio
```

Navigate to `Machine` model and verify:

- New machine appears
- All fields populated correctly
- `code` is unique
- `category` maps to correct category

**Using SQL:**

```sql
SELECT code, name, category, "dailyRate", deposit
FROM "Machine"
WHERE code = '<machine-code>';
```

Always verify after seeding production.

---

## Important Notes

### Machine Code Best Practices

- Use descriptive, stable identifiers (e.g., `MINI-DUMPER-500`, not `machine-16`)
- Codes NEVER change (they're used for upsert matching)
- Use UPPERCASE with hyphens for readability
- Include capacity/size in code when relevant

### Image Handling

**CRITICAL:** The `Image` column in CSV is stored as `referenceUrl` and is NOT rendered by the UI.

- UI uses curated local assets from `/public/images/machines/`
- CSV `Image` field is for ops reference only
- See [updating-machine-images.md](updating-machine-images.md) for how to add images to UI

### Upsert Behavior

The seed script uses `upsert` by machine code:

- If code exists: updates all fields
- If code doesn't exist: creates new machine

This means you can edit CSV values and re-run seed to update existing machines.

### Safety Rails

- `SEED_RESET=1` is forbidden in production (prevents accidental data loss)
- Validation exits immediately on first error
- Numeric fields must be valid numbers
- Empty required fields fail validation

---

## Troubleshooting

### Error: "Unique constraint failed on fields: `code`"

**Cause:** Code already exists in database but doesn't match CSV code

**Fix:** Check for typos in CSV code, or use different code

### Error: "dailyRate must be greater than 0"

**Cause:** Price per day is 0 or negative

**Fix:** Set valid positive price in CSV

### Error: "deposit must be non-negative"

**Cause:** Deposits column is negative

**Fix:** Set deposit to 0 or positive value

### Machine not appearing in UI

**Likely causes:**

1. Category doesn't match existing categories (check [lib/content/machine-categories.ts](../../lib/content/machine-categories.ts))
2. Machine seeded but UI filters don't include it
3. Cache issue (try hard refresh)

**Verify:**

```bash
# Check machine exists in DB
npx prisma studio
```

If you see a warning about unknown category during seed, the machine may render with title-cased fallback display. Fix by using an approved category from the list above.

---

## Testing the New Machine

### Local Testing Checklist

1. Machine appears on homepage machine grid
2. Machine detail page renders correctly (`/machine/[code]`)
3. Booking form shows correct pricing
4. Availability calendar works
5. Checkout includes correct daily rate and deposit

### E2E Testing

Run booking flow E2E test with new machine:

```bash
npm run test:e2e
```

Or manually test:

1. Navigate to machine page
2. Select dates
3. Complete booking form
4. Verify pricing in checkout

---

## Rollback

If you need to remove a machine:

### Option 1: Remove from CSV and Re-seed

1. Delete row from `machines.csv`
2. Run `SEED_RESET=1 npm run db:seed` (local/staging only)

### Option 2: Database Deletion

```sql
DELETE FROM "Machine" WHERE code = 'MINI-DUMPER-500';
```

**WARNING:** Cannot delete machines with existing bookings (foreign key constraint)

---

## Related Documentation

- [Updating Machine Images](updating-machine-images.md) - How to add/change machine photos
- [Pricing and Availability Changes](pricing-and-availability-changes.md) - How to update pricing
- [Local Setup](../development/local-setup.md) - Database setup guide

---

## Source Pointers

- **CSV Source:** `prisma/data/machines.csv`
- **Seed Script:** `prisma/seed.ts`
- **Prisma Schema:** `prisma/schema.prisma` (Machine model)
- **Category Definitions (Single Source of Truth):** `lib/content/machine-categories.ts`
- **Machine Display Logic:** `lib/content/machines.ts`
- **Machine Pages:** `app/machine/[code]/page.tsx`

---

**Last Updated:** 2026-01-14
