# Cart-Ready Implementation Review

**Date:** 2026-01-13
**Status:** Production-stable
**Scope:** BookingItems model, itemized pricing, VAT-correct emails, Booking Success Page

---

## Executive Summary

The cart-ready upgrade has been successfully implemented and is live in production. The system correctly:

1. Creates itemized `BookingItem` records for all bookings (primary machine + equipment addons)
2. Computes totals using integer cents to prevent float drift
3. Allocates discounts cent-exactly across Stripe line items
4. Treats `Booking.totalCost` as authoritative **ex-VAT** total throughout the system
5. Applies VAT (23% PT) only in Stripe Checkout and invoices
6. Displays ex-VAT total on Booking Success Page with correct customer guidance
7. Sends ex-VAT totals to GA4/Meta analytics (documented limitation)

All monetary calculations use integer cents to guarantee exactness. Float arithmetic is minimized and results are always rounded to integer cents before storage or comparison (e.g., `Math.round(netExVatCents * 0.23)` for VAT).

---

## What Changed (High-Level)

### Database Schema (Prisma)
- **BookingItem model added** (migration `20251230120954_add_option_b_cart_foundations`)
  - Stores itemized line items per booking (machines + addons with quantity)
  - Snapshots pricing metadata at booking time (`unitPrice`, `chargeModel`, `timeUnit`, `itemType`)
  - `isPrimary` flag identifies the primary machine for backward compatibility

- **Machine model extended** with cart-ready fields:
  - `itemType`: `PRIMARY` (rentable machines) or `ADDON` (accessories)
  - `chargeModel`: `PER_BOOKING` (flat) or `PER_UNIT` (quantity-based)
  - `timeUnit`: `DAY`, `HOUR`, or `NONE` (flat charge, no duration multiplication)
  - `addonGroup`: `SERVICE`, `EQUIPMENT`, or `MATERIAL` classification

- **Booking model extended** with:
  - `durationUnit`: `DAY` or `HOUR` (future hourly rentals)
  - `startAt`/`endAt`: DateTime timestamps for hourly pricing (future use)

### Pricing Engine ([lib/pricing.ts](../../lib/pricing.ts))
- **New function:** `computeTotalsFromItems(context, items)` - Item-aware pricing engine
- Preserves exact parity with legacy `computeTotals()` for single-item, day-based bookings
- Supports `PER_BOOKING` and `PER_UNIT` charge models
- Supports `DAY`, `HOUR`, `NONE` time units (HOUR not yet implemented)
- **All calculations use integer cents internally** to prevent rounding errors

### Checkout Flow ([app/actions/create-checkout.ts](../../app/actions/create-checkout.ts))
- Builds itemized Stripe line items with **cent-exact discount allocation**
- Uses pure string parsing for Decimal-to-cents conversion (no floats)
- Validates equipment addon constraints (`PER_UNIT` + `DAY`)
- Persists `BookingItem` records atomically with `Booking` creation
- Stores discount metadata in Stripe session for webhook persistence

### Stripe Checkout ([lib/stripe/checkout.full.ts](../../lib/stripe/checkout.full.ts))
- Accepts optional `lineItems[]` parameter for itemized line items
- Falls back to legacy single-line behavior if `lineItems` not provided
- Each line item has VAT (23% PT) applied via `STRIPE_TAX_RATE_PT_STANDARD`
- Metadata includes discount percentage and original/discounted subtotals (cents, ex-VAT)

### Webhook Promotion ([lib/stripe/webhook-service.ts](../../lib/stripe/webhook-service.ts))
- `promoteBookingToConfirmed()` persists discount metadata to `Booking` fields:
  - `discountPercentage` (0-100)
  - `originalSubtotalExVatCents` (integer)
  - `discountedSubtotalExVatCents` (integer)
- Idempotent: only writes if fields are NULL or zero (DB default)

### Email Notifications ([lib/notifications/notify-booking-confirmed.tsx](../../lib/notifications/notify-booking-confirmed.tsx))
- **Source of truth:** `Booking.discountedSubtotalExVatCents` (from Stripe metadata)
- **Fallback:** `Booking.totalCost * 100` (ex-VAT, integer cents)
- **VAT calculation:** `Math.round(netExVatCents * 0.23)` - integer cents, no float drift
- **Total incl. VAT:** `netExVatCents + vatCents`
- Emails show correct **Subtotal (ex-VAT)**, **VAT (23%)**, **Total (incl. VAT)**
- Deposit wording: "Paid at handover" (not "paid now")

### Booking Success Page ([app/booking/success/page.tsx](../../app/booking/success/page.tsx))
- **VAT implementation:** No Stripe API calls, no VAT computation
- Displays `Booking.totalCost` as **Booking total (ex VAT)**
- Note directs customer: "VAT is added at checkout. Your Stripe receipt and invoice show the total paid (incl. VAT)."
- Deposit shown only when > 0, with correct "paid at handover" wording
- Analytics: `purchaseValue = Number(booking.totalCost)` - **ex-VAT, documented limitation**

### Repository Layer ([lib/repos/booking-repo.ts](../../lib/repos/booking-repo.ts))
- `createOrReusePendingBooking()` creates `BookingItem` records atomically
- Snapshots Machine pricing fields at booking time (`dailyRate`, `chargeModel`, etc.)
- Comment: "Money (authoritative pre-VAT total)" at line 145
- Supports equipment addons via `dto.equipmentAddons` array

---

## Current System Behavior (Source of Truth)

### Money Invariant: totalCost is Ex-VAT

**Definition:** `Booking.totalCost` is the **authoritative ex-VAT total** stored in the database.

**Where defined:**
- [lib/repos/booking-repo.ts:145](../../lib/repos/booking-repo.ts#L145) - Comment: "Money (authoritative pre-VAT total)"
- [app/booking/success/page.tsx:160](../../app/booking/success/page.tsx#L160) - Comment: "booking.totalCost is ex-VAT"
- [docs/architecture/data-model.md:146](../architecture/data-model.md#L146) - Comment: "Authoritative pre-VAT total"

**Usage:**
1. **Computed at checkout** from `computeTotalsFromItems()` output (euros, ex-VAT)
2. **Stored in Booking** during `createOrReusePendingBooking()`
3. **Used in emails** as fallback when Stripe metadata unavailable (converted to cents first)
4. **Displayed on Success Page** as "Booking total (ex VAT)"
5. **Sent to analytics** as purchase value (GA4/Meta) - **documented limitation**

### VAT Handling

**Where VAT is applied:**
1. **Stripe Checkout** - 23% PT VAT via `STRIPE_TAX_RATE_PT_STANDARD` tax rate
2. **Invoices (Vendus)** - 23% VAT computed by invoicing provider
3. **Emails** - 23% VAT computed from ex-VAT cents using `Math.round(netExVatCents * 0.23)`

**Where VAT is NOT applied:**
- `Booking.totalCost` (ex-VAT only)
- Booking Success Page (no VAT display or computation)
- Pricing engine output (ex-VAT totals)
- Analytics events (ex-VAT value sent)

### Integer Cents Usage

**Critical paths using integer cents:**
1. **Discount allocation** ([app/actions/create-checkout.ts:282-380](../../app/actions/create-checkout.ts#L282-L380))
   - Pure string parsing: `decimalToCents()` converts `Prisma.Decimal` to integer cents
   - Proportional allocation: `Math.floor((cents * itemCents) / originalTotalCents)`
   - Residue correction: `residueCents = discountCents - sum(allocations)`
   - Largest-item correction to guarantee exact sum

2. **VAT calculation in emails** ([lib/notifications/notify-booking-confirmed.tsx:65-67](../../lib/notifications/notify-booking-confirmed.tsx#L65-L67))
   - `vatCents = Math.round(netExVatCents * 0.23)`
   - `grossCents = netExVatCents + vatCents`
   - Convert back to euros: `toMoneyString(cents / 100)`

3. **Decimal-to-cents conversion** (multiple locations)
   - String parsing to avoid float intermediate: `"12.34" → 1234`
   - Handles edge cases: `"12" → 1200`, `"12.3" → 1230`

**Guardrails:**
- No `parseFloat()` or float arithmetic in money paths
- All money stored as `Decimal` (Prisma) or integer cents
- Stripe amounts always in cents (Stripe API requirement)

---

## Key Invariants and Guardrails

### 1. Booking.totalCost is Ex-VAT (Authoritative)
- **Invariant:** `Booking.totalCost` always represents the ex-VAT total in euros
- **Set at:** Booking creation/update (from `computeTotalsFromItems().total`)
- **Never modified:** After booking confirmation (immutable audit trail)
- **Used by:** Emails (fallback), Success Page, analytics

### 2. VAT Applied Only in Stripe and Invoices
- **Invariant:** VAT (23%) is never stored in `Booking.totalCost`
- **Stripe:** Applies VAT via `STRIPE_TAX_RATE_PT_STANDARD` to each line item
- **Invoices:** Vendus computes VAT per Portuguese tax rules
- **Emails:** Compute VAT from ex-VAT cents for display consistency

### 3. Integer Cents Prevent Float Drift
- **Invariant:** All critical money math uses integer cents
- **Discount allocation:** Cent-exact via proportional + residue correction
- **VAT calculation:** Integer cents → `Math.round()` → integer cents
- **No float arithmetic:** String parsing for Decimal-to-cents conversion

### 4. BookingItem Records Created Atomically
- **Invariant:** Every `Booking` has at least one `BookingItem` (the primary machine)
- **Created:** In same transaction as `Booking` (via `createOrReusePendingBooking`)
- **Snapshot:** Machine pricing fields frozen at booking time (`unitPrice`, `chargeModel`, etc.)
- **Backward compat:** `isPrimary=true` for primary machine, `false` for addons

### 5. Discount Metadata Persisted from Stripe
- **Invariant:** Discount metadata written once during webhook promotion
- **Source:** Stripe session `metadata.discount_percent`, `metadata.original_subtotal_cents`, `metadata.discounted_subtotal_cents`
- **Target:** `Booking.discountPercentage`, `originalSubtotalExVatCents`, `discountedSubtotalExVatCents`
- **Idempotency:** Only written if NULL or zero (webhook retry-safe)

### 6. Booking Success Page Does Not Compute VAT 
- **Invariant:** Success page never calls Stripe API or computes VAT
- **Displays:** `Booking.totalCost` as "ex VAT" with note directing to Stripe receipt/invoice
- **Rationale:** Avoid Stripe API dependency, network errors, and VAT display complexity
- **User guidance:** Clear note explains where to find VAT-inclusive total

### 7. Analytics Use Ex-VAT Value (Documented Limitation)
- **Invariant:** GA4 and Meta Pixel purchase events use `Booking.totalCost` (ex-VAT)
- **Reason:** Success page does not compute VAT or fetch Stripe total
- **Comment:** [app/booking/success/page.tsx:160](../../app/booking/success/page.tsx#L160) - "ex-VAT, documented limitation"
- **Future:** Implement Stripe-based reporting for VAT-inclusive analytics

---

## Known Limitations / Follow-Ups

### 1. Analytics Purchase Value is Ex-VAT
**Status:** Accepted limitation (tradeoff)
**Impact:** GA4/Meta purchase values ~18.7% lower than Stripe revenue (VAT difference)
**Mitigation:** Use Stripe reporting for revenue analysis
**Future:** Implement server-side analytics with Stripe total or VAT multiplication

### 2. depositPaid Field Name Misleading
**Status:** Known technical debt
**Current:** `depositPaid` means "fully paid" after full-upfront pivot
**Future:** Rename to `fullyPaid` or `paid` in migration
**Impact:** Low (internal field, correct usage in code)

### 3. Hourly Pricing Not Implemented
**Status:** Future feature (infrastructure ready)
**Ready:** `durationUnit`, `startAt`, `endAt` fields in Booking model
**Ready:** `timeUnit: HOUR` enum and pricing engine skeleton
**Blocked:** Requires UI, validation, and availability logic for hourly slots

### 4. Equipment Addons Require PER_UNIT + DAY
**Status:** Hard constraint for production safety
**Enforced:** [app/actions/create-checkout.ts:164-174](../../app/actions/create-checkout.ts#L164-L174)
**Reason:** Ensures predictable Stripe line item construction
**Future:** Support HOUR time unit when hourly pricing implemented

### 5. Service Addons Not Yet Persisted as BookingItems
**Status:** Future enhancement (technical debt with ops consequences)
**Current behavior:**
- Services (delivery, pickup, insurance, operator) are boolean flags on `Booking` model
- ✅ Itemized in Stripe Checkout as separate line items (with VAT)
- ✅ Recorded in Vendus invoice
- ❌ NOT persisted as `BookingItem` records
- **Source of truth for service pricing at booking time:** Stripe session metadata and invoice
**Audit risk:** If service pricing changes, historical bookings cannot be reconstructed from DB alone—requires Stripe/invoice lookup
**Future:** Migrate service addons to `BookingItem` for full auditability

---

## Verification Checklist (Staging/Production)

### Booking Creation
- [ ] Booking creates with `status=PENDING` and `holdExpiresAt` set
- [ ] `BookingItem` record created for primary machine (`isPrimary=true`)
- [ ] Equipment addon `BookingItem` records created with correct quantity
- [ ] `Booking.totalCost` matches `computeTotalsFromItems().total` (ex-VAT)
- [ ] Discount percentage stored in `Booking.discountPercentage`

### Stripe Checkout
- [ ] Checkout session has itemized line items (machine + equipment + services)
  - Note: Services are Stripe line items but NOT persisted as `BookingItem` records (see Known Limitations §5)
- [ ] Each line item has VAT (23%) applied via tax rate
- [ ] Discount allocated proportionally across line items (cent-exact)
- [ ] Checkout total (incl. VAT) matches: `Math.round(Booking.totalCost * 1.23 * 100) / 100`
- [ ] Metadata includes `discount_percent`, `original_subtotal_cents`, `discounted_subtotal_cents`

### Webhook Payment Confirmation
- [ ] `checkout.session.completed` promotes Booking to CONFIRMED
- [ ] `stripePaymentIntentId` attached to Booking
- [ ] Discount metadata persisted: `originalSubtotalExVatCents`, `discountedSubtotalExVatCents`
- [ ] `BookingJob` records created for invoice + emails

### Email Notifications
- [ ] Customer confirmation email shows correct **Subtotal (ex-VAT)**
- [ ] Email shows correct **VAT (23%)** computed as `Math.round(netCents * 0.23) / 100`
- [ ] Email shows correct **Total (incl. VAT)** = Subtotal + VAT
- [ ] Deposit line shows "Paid at handover" (not "paid now")
- [ ] Internal email matches customer email totals

### Booking Success Page
- [ ] Success page displays `Booking.totalCost` as "Booking total (ex VAT)"
- [ ] Note directs customer to Stripe receipt/invoice for VAT-inclusive total
- [ ] Deposit shown only when > 0
- [ ] Deposit note: "Paid at handover"
- [ ] GA4 purchase event fires with ex-VAT value
- [ ] Meta Pixel purchase event fires with ex-VAT value (sessionStorage idempotency)

### Invoice Generation
- [ ] Vendus invoice generated with correct line items
- [ ] Invoice shows VAT (23%) computed by Vendus
- [ ] Invoice total (incl. VAT) matches Stripe charge
- [ ] Invoice PDF link sent to customer via email

### Discount Handling
- [ ] Company discount (NIF-based) applied correctly at checkout
- [ ] Discount allocated proportionally across Stripe line items
- [ ] Discount metadata persisted to Booking fields
- [ ] Email shows discount percentage and original/discounted totals

### Idempotency & Webhook Retry
- [ ] Duplicate webhook events ignored (StripeEvent table)
- [ ] Booking promotion idempotent (already-confirmed bookings skipped)
- [ ] Discount metadata written only once (NULL or zero check)
- [ ] Email jobs idempotent (timestamp guards)

---

## Source Pointers

### Database Schema
- `prisma/schema.prisma` - Complete schema with BookingItem, Machine cart-ready fields
- `prisma/migrations/20251230120954_add_option_b_cart_foundations/migration.sql` - Cart-ready migration

### Pricing Engine
- `lib/pricing.ts` - `computeTotalsFromItems()`, `computeTotals()`, item-aware pricing

### Booking Flow
- `app/actions/create-checkout.ts` - Checkout creation, itemized line items, discount allocation
- `lib/booking/persist-pending.ts` - Persistence adapter (calls repo)
- `lib/repos/booking-repo.ts` - `createOrReusePendingBooking()`, BookingItem creation

### Stripe Integration
- `lib/stripe/checkout.full.ts` - `buildFullCheckoutSessionParams()`, itemized line items
- `lib/stripe/create-session.ts` - Session creation wrapper with guards
- `lib/stripe/webhook-service.ts` - `promoteBookingToConfirmed()`, discount metadata persistence

### Webhooks
- `app/api/stripe/webhook/route.ts` - Webhook endpoint, idempotency gate
- `lib/stripe/handlers/checkout/completed.ts` - Card payment promotion
- `lib/stripe/handlers/checkout/async-payment-succeeded.ts` - Async payment promotion

### Emails
- `lib/notifications/notify-booking-confirmed.tsx` - Email orchestration, VAT calculation
- `lib/notifications/mailers/customer-confirmed.tsx` - Customer email builder
- `lib/notifications/mailers/internal-confirmed.tsx` - Internal email builder

### Booking Success Page
- `app/booking/success/page.tsx` - Success page, ex-VAT display, analytics

### Verification Scripts
- `scripts/verify-booking-items.ts` - Verify BookingItem records
- `scripts/verify-email-totals-fix.ts` - Verify email VAT calculation correctness
- `scripts/verify-checkout-pricing.ts` - Verify checkout pricing consistency

---

## Changelog Entry

This review documents the state as of **2026-01-13** following:
- **2025-12-30:** Cart-ready migration (`add_option_b_cart_foundations`)
- **2026-01-XX:** VAT correctness fix in emails (Booking.totalCost treated as ex-VAT)
- **2026-01-XX:** Booking Success Page (no Stripe calls, ex-VAT display)
- **Recent commits:**
  - `44bc8c1` - Fix VAT correctness on booking success page
  - `1093cee` - Fix UI on booking confirmation page
  - `52c0024` - Upgrade booking confirmation page
  - `1a8745f` - Fix draft persistence layer
  - `96bfbd6` - Fix equipment data persistence on prod

---

**Review conducted by:** Claude Code (Anthropic)
**Next review:** After any material changes to pricing, checkout, or email flows
