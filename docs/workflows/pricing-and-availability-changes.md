# Pricing and Availability Changes

Step-by-step guide for updating machine pricing, deposits, minimum rental days, and availability settings.

---

## Overview

Pricing is managed in the CSV file and seeded into the database. Changes to pricing require updating the CSV and re-seeding.

**Source of Truth:** [prisma/data/machines.csv](../../prisma/data/machines.csv)

**Seeding Script:** [prisma/seed.ts](../../prisma/seed.ts)

**Important:** Pricing changes do NOT affect existing bookings, only future bookings.

---

## Prerequisites

- Access to repository
- Node.js environment with dependencies installed
- Database access (local or staging for testing)

---

## Pricing Fields

| CSV Column | Database Field | Description | Example |
|------------|----------------|-------------|---------|
| **Price per day** | `dailyRate` | Daily rental rate in EUR (must be >0) | `35.00` |
| **Deposits** | `deposit` | Security deposit in EUR (must be >=0) | `100.00` |
| **Day minimum** | `minDays` | Minimum rental days (>=1 if set) | `1` |
| **Delivery charge** | `deliveryCharge` | Delivery fee in EUR (optional) | `50.00` |
| **Pick up charge** | `pickupCharge` | Pickup fee in EUR (optional) | `50.00` |

**Note:** All prices are in Euros (€). The platform automatically handles VAT display/calculation.

---

## Step-by-Step Process

### 1. Update CSV File

**File:** `prisma/data/machines.csv`

**Example:** Update daily rate for Mini Excavator from €35/day to €40/day

**Before:**
```csv
MINI-EXCAVATOR,100.00,Mini Excavators,Mini Excavator,Kubota KX018-4,1800kg,50.00,50.00,1,35.00,https://example.com/ref.jpg,Compact tracked excavator...
```

**After:**
```csv
MINI-EXCAVATOR,100.00,Mini Excavators,Mini Excavator,Kubota KX018-4,1800kg,50.00,50.00,1,40.00,https://example.com/ref.jpg,Compact tracked excavator...
```

**Column Index Reference:**
1. Code (MINI-EXCAVATOR)
2. Deposits (100.00)
3. Category (Mini Excavators)
4. Name (Mini Excavator)
5. Model (Kubota KX018-4)
6. Weight (1800kg)
7. Delivery charge (50.00)
8. Pick up charge (50.00)
9. Day minimum (1)
10. **Price per day (40.00)** ← Changed
11. Image (reference only)
12. Description

### 2. Validate Changes

**Required Field Validation:**
- `Price per day` must be >0 (e.g., 40.00, not 0)
- `Deposits` must be >=0 (can be 0 for no deposit)
- `Day minimum` must be >=1 if set (cannot be 0)

**Numeric Format:**
- Use decimal format: `40.00` not `40` or `€40`
- No currency symbols
- No thousands separators (use `1000.00` not `1,000.00`)

### 3. Test Locally (Recommended)

Before applying to production, test changes in local environment:

```bash
# Seed the specific machine to test
SEED_ONLY_CODE=MINI-EXCAVATOR npm run db:seed

# Expected output
Seeding machines...
  ✓ Upserted machine: MINI-EXCAVATOR
```

**Verify in Database:**
```bash
npx prisma studio
```

Navigate to `Machine` model and verify:
- `dailyRate` shows new value (e.g., 40.00)
- Other fields unchanged

**Test in UI:**
```bash
npm run dev
```

1. Navigate to machine page
2. Verify new price displays
3. Test booking flow calculates correctly

### 4. Apply to Production

**Option A: Direct Seed (Staging/Production)**

```bash
# Seed specific machine (safe, targeted)
SEED_ONLY_CODE=MINI-EXCAVATOR npm run db:seed

# Or seed all machines (updates all, slower)
npm run db:seed
```

**Cart-ready: Via Deployment**

1. Commit CSV changes
2. Push to `staging` branch
3. Verify on staging environment
4. Merge to `main` for production
5. Production deployment auto-runs migrations/seed if configured

---

## Common Scenarios

### Scenario 1: Increase Daily Rate

**Use Case:** Market adjustment, inflation, higher operating costs

**Steps:**
1. Update `Price per day` column in CSV
2. Seed the machine: `SEED_ONLY_CODE=<CODE> npm run db:seed`
3. Verify in UI

**Example:**
```csv
# Before
TELEHANDLER,200.00,Telehandlers,Telehandler,JCB 520-40,4000kg,75.00,75.00,1,120.00,...

# After (€120 → €130)
TELEHANDLER,200.00,Telehandlers,Telehandler,JCB 520-40,4000kg,75.00,75.00,1,130.00,...
```

### Scenario 2: Adjust Deposit

**Use Case:** Risk adjustment, damage patterns, machine value

**Steps:**
1. Update `Deposits` column in CSV
2. Seed the machine
3. Verify checkout shows new deposit

**Example:**
```csv
# Before (€100 deposit)
COMPACTOR,100.00,Compactors,Plate Compactor,...

# After (€150 deposit)
COMPACTOR,150.00,Compactors,Plate Compactor,...
```

**Special Case - No Deposit:**
```csv
# Set to 0.00 for no deposit
POWER-WASHER,0.00,Power Washers,Power Washer,...
```

UI will show "Deposit included" for 0 deposit.

### Scenario 3: Change Minimum Rental Days

**Use Case:** Seasonal demand, operational efficiency

**Steps:**
1. Update `Day minimum` column in CSV
2. Seed the machine
3. Test booking form enforces new minimum

**Example:**
```csv
# Before (1 day minimum)
LARGE-EXCAVATOR,500.00,Excavators,Large Excavator,...,1,250.00,...

# After (3 day minimum)
LARGE-EXCAVATOR,500.00,Excavators,Large Excavator,...,3,250.00,...
```

Booking form will now require minimum 3-day rental.

### Scenario 4: Update Delivery/Pickup Fees

**Use Case:** Fuel costs, distance adjustments

**Steps:**
1. Update `Delivery charge` and/or `Pick up charge` columns
2. Seed the machine
3. Verify checkout adds correct fees

**Example:**
```csv
# Before (€50 delivery, €50 pickup)
...,50.00,50.00,...

# After (€60 delivery, €60 pickup)
...,60.00,60.00,...
```

**Remove Delivery Option:**
```csv
# Set to empty (not 0) to hide delivery option
..., , ,...  # Empty cells between commas
```

### Scenario 5: Bulk Price Update (Multiple Machines)

**Use Case:** Across-the-board increase, category adjustment

**Steps:**
1. Update multiple rows in CSV
2. Seed all machines: `npm run db:seed`
3. Verify all changes in database

**Tip:** Use spreadsheet software (Excel, Google Sheets) to apply formula:
- Open CSV in Excel
- Select `Price per day` column
- Apply formula: `=J2*1.1` (10% increase)
- Save as CSV (UTF-8)

**Important:** Ensure CSV stays valid (no extra columns, correct format).

### Scenario 6: Temporary Price Promotion

**Problem:** CSV change is permanent, but you want limited-time discount

**Options:**

**Option A: Manual CSV Revert (Simple but Manual)**
1. Update CSV with promotional price
2. Seed database
3. Schedule reminder to revert
4. Update CSV back to original price
5. Re-seed

**Cart-ready: Code-Level Discount (Requires Dev Work)**

Create a promotional discount in code (not recommended for simple ops changes):

```typescript
// In lib/booking/pricing.ts (hypothetical)
const PROMO_DISCOUNTS: Record<string, number> = {
  "MINI-EXCAVATOR": 0.8, // 20% off
};
```

This requires developer involvement and code deployment.

**Option C: Company Discount Feature (Existing)**

Use the existing company discount feature (`CompanyDiscount` model) for specific customers, not blanket promotions.

**Recommendation:** For temporary promotions, use Option A (CSV + manual revert) or implement a proper promo code system (requires feature development).

---

## Availability Management

### Blocking Dates (Manual Booking)

**Use Case:** Machine under maintenance, reserved for specific customer, not bookable online

**Current Limitation:** The platform does NOT have a built-in "block dates" feature in the ops dashboard.

**Workaround:** Create a manual PENDING or CONFIRMED booking via database:

```sql
-- Create blocking booking (admin use)
INSERT INTO "Booking" (
  "machineCode",
  "startDate",
  "endDate",
  "during",
  "status",
  "customerName",
  "customerEmail",
  -- ... required fields
)
VALUES (
  'MINI-EXCAVATOR',
  '2025-12-15',
  '2025-12-20',
  tsrange('2025-12-15', '2025-12-20', '[]'),
  'CONFIRMED',
  'BLOCKED - Maintenance',
  'ops@amr-rentals.com',
  -- ... other values
);
```

**Better Solution (Future Feature):** Add "Block Dates" feature to ops dashboard (requires development).

### Hiding a Machine Temporarily

**Use Case:** Machine unavailable for extended period, don't want it shown in catalog

**Current Limitation:** No "active/inactive" flag in schema.

**Workaround:** Remove machine from CSV and re-seed (DESTRUCTIVE - not recommended).

**Better Solution (Future Feature):** Add `isActive` boolean field to `Machine` model (requires migration).

### Adjusting Hold Expiry Time

**Use Case:** Change how long PENDING bookings block dates before expiring

**Location:** `lib/booking/create-booking.ts`

```typescript
// Default: 30 minutes
const HOLD_EXPIRY_MINUTES = 30;

// To change (requires code change + deploy):
const HOLD_EXPIRY_MINUTES = 60; // 1 hour
```

**Note:** This is a code-level constant, not configurable via CSV or env var.

---

## Pricing Impact on Existing Bookings

**Important:** Pricing changes do NOT affect existing bookings.

**Why?**
- Booking records snapshot all pricing at time of creation
- Fields: `dailyRate`, `deposit`, `deliveryCharge`, `pickupCharge` are copied to booking
- Changing CSV only affects NEW bookings

**Example:**
- Customer booked Mini Excavator on Dec 1 at €35/day
- You update CSV to €40/day on Dec 2
- Customer's booking remains €35/day (immutable)
- New bookings starting Dec 2+ use €40/day

**To Adjust Existing Booking Pricing (Rare):**

Requires manual database update (ops admin task):

```sql
UPDATE "Booking"
SET "dailyRate" = 40.00
WHERE id = '<booking-id>';
```

**WARNING:** Only do this with customer agreement and clear communication.

---

## Troubleshooting

### Price Not Updating in UI

**Likely Causes:**
1. Seed script not run
2. Browser cache
3. Wrong machine code in SEED_ONLY_CODE

**Solutions:**
```bash
# Verify seed ran successfully (check output)
SEED_ONLY_CODE=MINI-EXCAVATOR npm run db:seed

# Check database
npx prisma studio

# Hard refresh browser (Ctrl+Shift+R)
```

### Validation Error: "dailyRate must be greater than 0"

**Cause:** CSV has 0 or negative value in `Price per day` column

**Fix:** Set valid positive price (e.g., `35.00`)

### Decimal Places Lost (40.50 becomes 40)

**Cause:** CSV saved without decimals

**Fix:** Ensure CSV editor preserves decimals:
- Use `.00` for whole numbers (e.g., `40.00` not `40`)
- Save as CSV UTF-8 (not Excel format)

### Wrong Column Updated

**Cause:** CSV column order changed or misaligned

**Fix:** Verify column order matches header:
```csv
Code,Deposits,Category,Name,Model,Weight,Delivery charge,Pick up charge,Day minimum,Price per day,Image,Description
```

Use spreadsheet software with column headers visible to avoid misalignment.

### Seed Script Exits with Error

**Error:** "Unique constraint failed on fields: `code`"

**Cause:** Duplicate machine codes in CSV

**Fix:** Ensure each machine has unique code in column 1

---

## VAT Handling

**Important:** Prices in CSV are **NET** (without VAT).

The platform automatically:
- Calculates VAT (23% PT standard rate)
- Displays both net and gross prices in UI
- Applies correct VAT rate at Stripe checkout
- Issues invoice with VAT breakdown

**Example:**
- CSV daily rate: `40.00` (net)
- UI displays: "€40/day + IVA" and "€49.20 with IVA"
- Stripe checkout: Uses tax rate ID from `STRIPE_TAX_RATE_PT_STANDARD` env var
- Invoice: Shows net, VAT, and gross

**You do NOT need to manually calculate or add VAT to CSV prices.**

---

## Testing Checklist

Before applying pricing changes to production:

- [ ] CSV values validated (positive numbers, correct format)
- [ ] Seed script runs without errors
- [ ] Database shows updated values (via Prisma Studio)
- [ ] Machine page displays new price
- [ ] Booking form calculates totals correctly
- [ ] Checkout shows correct line items
- [ ] Existing bookings unaffected (if any)
- [ ] CSV committed to git (version control)

---

## Related Documentation

- [Adding a New Machine](adding-a-new-machine.md) - Complete machine management
- [Data Model](../architecture/data-model.md) - Booking and Machine schema
- [Booking and Payments](../architecture/booking-and-payments.md) - Payment flow details

---

## Source Pointers

**Pricing Data:**
- CSV Source: `prisma/data/machines.csv`
- Seed Script: `prisma/seed.ts` (validation logic lines 15-120)
- Machine Model: `prisma/schema.prisma` (Machine model definition)

**Pricing Logic:**
- Checkout: `app/actions/create-checkout.ts` (total calculation)
- Booking Creation: `lib/booking/create-booking.ts` (snapshot pricing)
- Availability: `lib/booking/get-availability.ts` (hold expiry)

**UI Display:**
- Machine Cards: `components/machine-card.tsx` (price formatting)
- Booking Form: `components/booking/booking-form.tsx` (price display)
- Checkout: `lib/stripe/checkout.full.ts` (Stripe line items)

---

**Last Updated:** 2025-12-29
