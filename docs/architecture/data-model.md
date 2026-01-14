# Data Model

Complete documentation of the Prisma schema and database models.

## Overview

The system uses Prisma ORM with PostgreSQL, modeling three core domains:
1. **Machinery inventory** (Machine)
2. **Customer bookings** (Booking, lifecycle states, date ranges)
3. **Payment/invoice records** (StripeEvent, BookingJob, CompanyDiscount)

All dates are stored in UTC but normalized to Europe/Lisbon timezone for display and business logic.

## Core Models

### Machine

Represents rental inventory with pricing and constraints.

**File:** `prisma/schema.prisma` (lines 11-37)

```prisma
model Machine {
  id             Int       @id @default(autoincrement())
  code           String    @unique
  name           String    @unique
  description    String
  imageUrl       String    // Deprecated for rendering
  referenceUrl   String?   // Ops reference only
  dailyRate      Decimal
  weight         String
  deposit        Decimal
  deliveryCharge Decimal?
  minDays        Int       @default(1)
  pickupCharge   Decimal?
  category       String    @default("Uncategorized") @map("type")  // DB column: "type"
  model          String?   // e.g., "Bobcat E35", "CAT 259D3"
  sizeRank       Int       @default(99)  // Catalog ordering (1-99, lower = smaller)
  bookings       Booking[]
}
```

**Key Points:**
- `category` field mapped to DB column `type` for legacy compatibility
- `minDays` enforces minimum rental duration (typically 1-7 days)
- `sizeRank` controls catalog display order within categories (10=micro, 20=mini, 30=medium, 40=large, 50+=heavy, 99=default/unranked)
- `imageUrl` deprecated (app uses curated local assets instead)
- `referenceUrl` for ops team reference only, not rendered to customers

**Heavy Machines (Lead-Time Enforcement):**
- Machine IDs 5, 6, 7 (medium/large excavators, telehandler)
- Require 2 business days advance notice
- Cutoff: 15:00 Lisbon time
- Implementation: `lib/repos/booking-repo.ts` (lines 96-98, 201-226)

---

### Booking

Central entity capturing rental lifecycle from pending hold through payment to invoicing.

**File:** `prisma/schema.prisma` (lines 39-135)

#### Core Fields

```prisma
model Booking {
  id         Int           @id @default(autoincrement())
  machineId  Int
  machine    Machine       @relation(fields: [machineId], references: [id])
  status     BookingStatus @default(PENDING)  // PENDING | CONFIRMED | CANCELLED

  // Date range (UTC storage, Lisbon timezone for business logic)
  startDate      DateTime
  endDate        DateTime
  holdExpiresAt  DateTime?  @db.Timestamp(6)  // 30-min rolling window
  during         Unsupported("tsrange")?  // Generated: [startDate, endDate] inclusive

  // Customer contact
  customerName   String
  customerEmail  String
  customerPhone  String
  customerNIF    String?  // Portuguese tax ID (optional for B2C)

  // Timestamps
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt

  // Relations
  jobs           BookingJob[]
}
```

#### Lifecycle States

```prisma
enum BookingStatus {
  PENDING     // Awaiting payment (30-min hold)
  CONFIRMED   // Paid + invoice issued
  CANCELLED   // Cancelled by customer or ops
}
```

**State Transitions:**
```
PENDING
  ├→ [Payment success] → CONFIRMED
  ├→ [Hold expires] → (Still PENDING, filtered by availability logic)
  └→ [Customer/ops cancel] → CANCELLED

CONFIRMED
  └→ [Refund/cancel] → CANCELLED (refundStatus tracks partial/full)

CANCELLED
  └→ [Terminal state]
```

#### Date Range Handling

```prisma
during: Unsupported("tsrange")?
  @default(dbgenerated("tsrange(\"startDate\", \"endDate\", '[]'::text)"))
```

**Implementation:**
- PostgreSQL `tsrange` type (timestamp range)
- `'[]'` = inclusive on both bounds: [startDate, endDate]
- Auto-generated (stored column), updated on INSERT/UPDATE
- Used for overlap detection with `&&` operator (GIST index)

**Database Constraint:**
```sql
-- Prevent overlaps for PENDING/CONFIRMED bookings on same machine
ALTER TABLE "Booking"
  ADD CONSTRAINT "booking_no_overlap_for_active"
  EXCLUDE USING gist (
    "machineId" WITH =,
    "during"    WITH &&
  )
  WHERE ("status" IN ('PENDING'::"BookingStatus", 'CONFIRMED'::"BookingStatus"));
```

**Source:** `prisma/migrations/20250829141036_booking_overlap_guards/migration.sql`

#### Payment & Pricing

```prisma
totalCost                    Decimal   // Authoritative ex-VAT total (euros, source of truth)
depositPaid                  Boolean   @default(false)  // Repurposed: means "fully paid"
stripePaymentIntentId        String?   @unique
stripeChargeId               String?
discountPercentage           Decimal?  @default(0)  // 0-100
originalSubtotalExVatCents   Int?      // Stripe metadata (ex-VAT, before discount)
discountedSubtotalExVatCents Int?      // Stripe metadata (ex-VAT, after discount)
```

**Critical Invariant:** `totalCost` is the **authoritative ex-VAT total** in euros. VAT (23%) is applied only in Stripe Checkout and invoices, never stored in this field. All downstream systems (emails, success page, analytics) treat `totalCost` as ex-VAT.

**Note:** `depositPaid` field historically meant "deposit paid", now repurposed to mean "fully paid" after pivot to full upfront payment. Future migration should rename to `fullyPaid`.

**Stripe Metadata Cents:** `originalSubtotalExVatCents` and `discountedSubtotalExVatCents` are integer cents (ex-VAT) persisted from Stripe checkout metadata during webhook promotion. Used by email notifications for cent-exact VAT calculation.

#### Add-ons (Boolean Flags)

```prisma
insuranceSelected  Boolean  @default(true)
deliverySelected   Boolean  @default(true)
pickupSelected     Boolean  @default(true)
operatorSelected   Boolean  @default(false)
```

#### Billing Address (Business Customers)

```prisma
billingIsBusiness    Boolean  @default(false)
billingCompanyName   String?
billingTaxId         String?  // Portuguese NIF for business billing
billingAddressLine1  String?
billingPostalCode    String?
billingCity          String?
billingCountry       String?
```

**Validation:** When `billingIsBusiness === true`, all billing fields are required.

#### Site Address (Operational, NOT for invoicing)

```prisma
siteAddressLine1      String?
siteAddressPostalCode String?
siteAddressCity       String?
siteAddressNotes      String?
```

**Purpose:** Delivery/pickup location. Separate from billing address.

#### Invoice Metadata

```prisma
invoiceProvider    String?  // e.g., "vendus"
invoiceProviderId  String?  // Provider's internal document ID
invoiceNumber      String?  // Human-readable (e.g., "FT 2025/123")
invoicePdfUrl      String?  // HTTPS link to PDF
invoiceAtcud       String?  // Portuguese validation code

@@unique([invoiceProvider, invoiceProviderId])
```

**Unique Constraint:** One invoice per provider per provider ID (allows provider swaps while preserving history).

#### Email Tracking

```prisma
confirmationEmailSentAt  DateTime?  @db.Timestamp(6)
invoiceEmailSentAt       DateTime?  @db.Timestamp(6)
internalEmailSentAt      DateTime?  @db.Timestamp(6)
```

**Purpose:**
- Idempotency guards (only send if timestamp is NULL)
- Audit trail (know exactly when each notification was dispatched)

#### Refund Tracking

```prisma
enum RefundStatus {
  NONE     // No refund activity
  PARTIAL  // Some amount refunded
  FULL     // Entire payment refunded
}

refundStatus           RefundStatus  @default(NONE)
refundedAmountCents    Int           @default(0)
refundIds              String[]      // Stripe refund IDs
```

**Source:** `prisma/migrations/20250916133443_add_refunds_disputes_and_stripe_event_log/migration.sql`

#### Dispute Tracking

```prisma
enum DisputeStatus {
  NONE   // No dispute
  OPEN   // Dispute filed by customer
  WON    // Merchant won
  LOST   // Merchant lost
}

disputeId         String?
disputeStatus     DisputeStatus  @default(NONE)
disputeReason     String?
disputeClosedAt   DateTime?
```

**Note:** Booking status remains CONFIRMED even during disputes (only dispute fields update).

---

### StripeEvent (Webhook Idempotency)

Ensures each Stripe webhook event processes exactly once.

**File:** `prisma/schema.prisma` (lines 137-144)

```prisma
model StripeEvent {
  id        Int      @id @default(autoincrement())
  eventId   String   @unique  // Stripe's event ID
  type      String   // Event type (e.g., "payment_intent.succeeded")
  bookingId Int?     // Nullable (not all events map to bookings)
  createdAt DateTime @default(now())
}
```

**Invariant:** Each `eventId` is globally unique. Duplicate webhook deliveries are detected and skipped.

**Implementation:** `app/api/stripe/webhook/route.ts` (lines 65-83)
- Attempts `db.stripeEvent.create({ eventId, type })`
- On `P2002` unique constraint error → return 200 ACK (idempotent)
- On success → process event

---

### BookingJob (Async Job Queue)

Durable job queue for booking-related side effects.

**File:** `prisma/schema.prisma` (lines 167-190)

```prisma
model BookingJob {
  id          Int      @id @default(autoincrement())
  bookingId   Int
  booking     Booking  @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  type        String   // "issue_invoice" | "send_customer_confirmation" | etc.
  status      String   // "pending" | "processing" | "completed" | "failed"
  attempts    Int      @default(0)
  maxAttempts Int      @default(3)
  payload     Json?    // Job-specific data
  result      Json?    // Result or error message
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  processedAt DateTime?

  @@unique([bookingId, type])  // One job per booking per type
  @@index([status, createdAt]) // For queue polling
}
```

**Job Types:**
- `issue_invoice` - Issue Vendus invoice
- `send_customer_confirmation` - Send confirmation email
- `send_internal_confirmation` - Send ops notification
- `send_invoice_ready` - Send invoice PDF link email

**Lifecycle:**
1. Created: `{ status: "pending", attempts: 0 }`
2. Claimed: `{ status: "processing", attempts: 1 }` (atomic update)
3. Completed: `{ status: "completed", processedAt: now(), result: {...} }`
4. Failed: `{ status: "failed", attempts: 3, result: { error: "..." } }` (after max retries)

**Idempotency:** Unique constraint on `(bookingId, type)` ensures one job per action.

---

### CompanyDiscount

Company-specific discounts based on Portuguese tax ID (NIF).

**File:** `prisma/schema.prisma` (lines 192-201)

```prisma
model CompanyDiscount {
  id                 Int      @id @default(autoincrement())
  nif                String   @unique  // Portuguese tax ID
  discountPercentage Decimal  // 0-100
  companyName        String?
  active             Boolean  @default(true)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
}
```

**Lookup:** GET `/api/check-discount?nif=<string>` returns `{ discountPercentage: number }`.

**Source:** `app/api/check-discount/route.ts`

---

### BookingItem (Cart-Ready Itemization)

Itemized line items for bookings, enabling multi-item carts and quantity-based pricing.

**File:** `prisma/schema.prisma` (lines 224-253)

```prisma
model BookingItem {
  id        Int     @id @default(autoincrement())
  bookingId Int
  machineId Int
  booking   Booking @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  machine   Machine @relation(fields: [machineId], references: [id])

  /// Quantity of this item (1 for PRIMARY machines, N for PER_UNIT addons)
  quantity Int @default(1)

  /// Snapshot: item type at booking time
  itemType    MachineItemType @default(PRIMARY)
  /// Snapshot: charge model at booking time
  chargeModel ChargeModel     @default(PER_BOOKING)
  /// Snapshot: time unit at booking time
  timeUnit    TimeUnit        @default(DAY)
  /// Snapshot: unit price at booking time (required, always set)
  unitPrice   Decimal

  /// Marks the primary machine for this booking (backward compat)
  isPrimary Boolean @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([bookingId])
  @@index([machineId])
  @@index([bookingId, isPrimary])
}
```

**Key Points:**
- **Created atomically** with Booking (same transaction)
- **Snapshots pricing** at booking time (`unitPrice`, `chargeModel`, `timeUnit`, `itemType`)
- **Primary machine:** One item per booking with `isPrimary=true`
- **Equipment addons:** Zero or more items with `itemType=ADDON`, `addonGroup=EQUIPMENT`, `chargeModel=PER_UNIT`
- **Future service addons:** Delivery, pickup, insurance, operator will migrate to BookingItem records

**Pricing Calculation:**
```typescript
// For each item:
base = chargeModel === "PER_UNIT" ? unitPrice * quantity : unitPrice
itemTotal = timeUnit === "DAY" ? base * rentalDays : base
```

**Source:** `lib/pricing.ts` (`computeTotalsFromItems()`)

**Migration:** `20251230120954_add_option_b_cart_foundations`

---

## Booking Lifecycle Invariants

### Hold Expiry (30-Minute Window)

**Purpose:** Prevent cart abandonment from blocking inventory indefinitely.

**Implementation:** `lib/repos/booking-repo.ts` (lines 228-229)
```typescript
const newExpiry = new Date(Date.now() + 30 * 60 * 1000);  // 30 minutes
```

**Behavior:**
- Set at creation: `holdExpiresAt = now() + 30 minutes`
- Extended on reuse: if existing hold > new expiry, keep old; else update
- Cleared on payment: `holdExpiresAt = null` (CONFIRMED bookings have no expiry)

**Expiry Mechanism:**
- Availability logic filters expired holds automatically
- Optional cron: `/api/cron/expire-holds` cancels expired PENDING bookings
- Grace period: 2 minutes ago (to avoid race conditions)

### Overlap Prevention

**Database-Level Enforcement:**
```sql
-- GIST index + EXCLUDE constraint
CREATE INDEX IF NOT EXISTS "booking_during_gist"
  ON "Booking" USING gist ("during");

ALTER TABLE "Booking"
  ADD CONSTRAINT "booking_no_overlap_for_active"
  EXCLUDE USING gist (
    "machineId" WITH =,
    "during"    WITH &&
  )
  WHERE ("status" IN ('PENDING', 'CONFIRMED'));
```

**Application-Level Safeguard:**
- Advisory locks: `SELECT pg_advisory_xact_lock(machineId)` serializes writes per machine
- Transaction wraps: query existing bookings → check overlap → insert/update

**Source:** `lib/repos/booking-repo.ts` (lines 237-245)

### Lead-Time Enforcement (Heavy Machines)

**Machines:** IDs 5, 6, 7 (medium/large excavators, telehandler)

**Rule:**
- Minimum 2 **business days** advance notice
- Cutoff: 15:00 Lisbon time
- Business days: Mon-Fri (skip weekends)

**Implementation:** `lib/repos/booking-repo.ts` (lines 96-98, 201-226)

**Error:** Throws `LeadTimeError` with `earliestAllowedDay` and `minDays` fields.

**Bypass:** Ops bookings can bypass via `bypassLeadTime: true` option.

---

## Date Handling Patterns

### Lisbon Timezone Normalization

All dates stored in UTC, normalized to Lisbon calendar day for consistency:

**Source:** `lib/validation/booking.ts` (lines 5-11)
```typescript
function rentalDays(from: Date, to: Date) {
  const f = startOfLisbonDayUTC(from);  // 00:00 Lisbon (expressed in UTC)
  const t = startOfLisbonDayUTC(to);
  return differenceInCalendarDays(t, f) + 1;  // Inclusive
}
```

**Example:**
- Start: 2025-09-30, End: 2025-10-01
- Rental days: 2 (inclusive counting)

### Inclusive Range Semantics

PostgreSQL `tsrange` uses `'[]'` bounds (inclusive on both ends):
- `[2025-09-30 00:00, 2025-10-01 00:00]` includes both Sept 30 and Oct 1
- Matches human expectation for "Sept 30 through Oct 1 = 2 days"

---

## Migration History (Key Changes)

**Notable Migrations:**

| Date | Migration | Purpose |
|------|-----------|---------|
| 2025-08-29 | `booking_overlap_guards` | tsrange + GIST constraint |
| 2025-08-29 | `add_hold_expires_at` | Hold expiry tracking |
| 2025-09-08 | `full_upfront_drop_authorized` | Pivot to full payment |
| 2025-09-10 | `add_invoice_fields` | Vendus invoice persistence |
| 2025-09-16 | `add_refunds_disputes_and_stripe_event_log` | Payment reconciliation |
| 2025-09-22 | `add_booking_confirmation_email_sent` | Email tracking |
| 2025-10-23 | `add_company_discounts` | Company discount table + discount% on Booking |
| 2025-12-19 | `add_booking_job` | Async job queue |
| 2026-01-14 | `add_size_rank` | Catalog ordering field for machines |

**Full History:** `prisma/migrations/` directory

---

## Validation Patterns

### Zod Schemas

**File:** `lib/validation/booking.ts`

**Base Schema:**
```typescript
baseBookingFormSchema
  - dateRange (from, to)
  - Contact: name, email, phone, customerNIF (optional 9-digit)
  - Add-ons: deliverySelected, pickupSelected, insuranceSelected, operatorSelected
  - Site Address: line1, postalCode, city, notes (optional)
  - Billing: isBusiness, companyName, taxId, addressLine1, postalCode, city, country
  - Discount: discountPercentage (0-100)
```

**Runtime Schema:**
```typescript
buildBookingSchema(minStart, minDays)
  - startDate >= minStart (Lisbon calendar day)
  - rentalDays(startDate, endDate) >= minDays
  - If billingIsBusiness, all billing fields required
  - If deliverySelected || pickupSelected, siteAddress required
```

### Custom Error Classes

**File:** `lib/repos/booking-repo.ts`

```typescript
class LeadTimeError extends Error {
  earliestAllowedDay: Date
  minDays: number
}

class OverlapError extends Error {
  // Default message: "Selected dates are no longer available."
}
```

---

## Source Pointers

**Prisma Schema:**
- `prisma/schema.prisma` - Complete data model

**Migrations:**
- `prisma/migrations/` - All migration SQL files

**Repository:**
- `lib/repos/booking-repo.ts` - Booking creation, state transitions, availability
- `lib/db.ts` - Prisma client singleton

**Validation:**
- `lib/validation/booking.ts` - Zod schemas

**Webhook Service:**
- `lib/stripe/webhook-service.ts` - Payment confirmation, booking promotion

**Job Processing:**
- `lib/jobs/process-booking-jobs.ts` - Job queue processor

---

## Open Questions / Risks

None identified. Schema is stable and in production.

---

**See Also:**
- [System Overview](overview.md) - High-level architecture
- [Booking & Payments](booking-and-payments.md) - Payment flow
- [Async Job Queue](async-jobs.md) - BookingJob processing
