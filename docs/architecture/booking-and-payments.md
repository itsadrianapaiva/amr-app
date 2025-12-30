# Booking & Payments

Complete documentation of the booking workflow and Stripe payment integration.

## Booking Flow Overview

```
Customer → Machine Detail Page → Booking Form → Stripe Checkout → Webhook → Confirmation
```

## Step-by-Step Flow

### 1. Machine Selection & Form Display

**Entry Point:** `GET /machine/[id]`

**File:** `app/machine/[id]/page.tsx`

**Server-Side Data Loading:**
```typescript
// Fetch machine details
const machine = await getMachineById(id);

// Fetch disabled date ranges (CONFIRMED bookings)
const disabled = await getDisabledDateRangesForMachine(id);

// Render BookingForm with machine + availability
<BookingForm machine={machine} disabledRanges={disabled} />
```

**Client Component:** `components/booking/booking-form.tsx`
- Date picker (react-day-picker) with disabled ranges
- Add-on checkboxes (delivery, pickup, insurance, operator)
- Billing address fields (conditional on isBusiness)
- Site address fields (conditional on delivery/pickup)
- Client-side total calculation preview

---

### 2. Form Submission → Checkout Creation

**Server Action:** `app/actions/create-checkout.ts`

**Function:** `createCheckoutAction(prevState, formData)`

#### Steps:

**A. Input Validation**
```typescript
// Parse and validate form data
const rawInput = parseBookingInput(formData);

// Build runtime schema with machine constraints
const schema = buildBookingSchema(minStart, machine.minDays);

// Validate
const validated = schema.parse(rawInput);
```

**B. Service Area Check (Geofencing)**
```typescript
if (deliverySelected || pickupSelected) {
  const { lat, lng } = await geocodeAddress(siteAddress);
  const inArea = checkServiceArea({ lat, lng });
  if (!inArea) throw new Error("Address outside service area");
}
```

**File:** `lib/geo/check-service-area.ts`

**C. Compute Totals**
```typescript
const totals = computeTotals({
  machine,
  days: rentalDays(startDate, endDate),
  addOns: { delivery, pickup, insurance, operator },
  discountPercent
});

// Returns: { subtotalExVat, discountExVat, netExVat, vat, total }
```

**File:** `lib/booking/compute-totals.ts`

**D. Create/Reuse PENDING Booking**
```typescript
const bookingId = await createOrReusePendingBooking(dto, { bypassLeadTime: false });
```

**Idempotent Reuse Pattern:** If same customer + machine + dates exist in PENDING state within 30 minutes, reuse that booking ID and extend the hold.

**File:** `lib/repos/booking-repo.ts` (lines 182-327)

**E. Build Stripe Checkout Session**
```typescript
const params = buildFullCheckoutSessionParams({
  bookingId,
  machine,
  startDate,
  endDate,
  customer: { email, name },
  totals,
  addOns,
  discount
});

const session = await createCheckoutSessionWithGuards(params);
```

**Session Configuration:**
- **Mode:** `payment` (full upfront, not authorization)
- **Locale:** `"en"` (avoid Stripe locale chunk warnings)
- **Customer:** Always create (`customer_creation: "always"`)
- **Tax:** Fixed PT VAT 23% (via `STRIPE_TAX_RATE_PT_STANDARD`)
- **Metadata:** bookingId, machineId, dates, flow, discount info
- **Success URL:** `/booking/success?session_id={CHECKOUT_SESSION_ID}&booking_id={bookingId}`
- **Cancel URL:** `/machine/{machineId}?checkout=cancelled`

**Files:**
- `lib/stripe/checkout.full.ts` - Session builder
- `lib/stripe/create-session.ts` - Creation wrapper with guards

**Idempotency Key:**
```typescript
// Format: booking-{id}-full-v3-{sha1_hash_of_selections_first_16_chars}
makeCheckoutIdempotencyKey(bookingId, selections);
```

**Purpose:** Same selections reuse same session; changed selections create new session.

**F. Return Checkout URL**
```typescript
return { ok: true, url: session.url };
```

Browser redirects to Stripe Checkout.

---

### 3. Customer Payment (Stripe Checkout)

Customer enters payment details on Stripe-hosted page:
- **Card:** Immediate payment confirmation
- **MB WAY:** Push notification to phone, async confirmation
- **SEPA:** Direct debit, async confirmation (days)

On success, Stripe redirects to `/booking/success?booking_id=123`.

On cancel, Stripe redirects to `/machine/{id}?checkout=cancelled`.

---

### 4. Webhook Delivery → Payment Confirmation

**Webhook Endpoint:** `POST /api/stripe/webhook`

**File:** `app/api/stripe/webhook/route.ts`

#### Processing Pipeline:

**A. Signature Verification**
```typescript
const sig = req.headers.get("stripe-signature");
const event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
```

**On failure:** Return 400 → Stripe retries.

**B. Idempotency Gate**
```typescript
try {
  await db.stripeEvent.create({ data: { eventId: event.id, type: event.type } });
} catch (err) {
  if (err.code === "P2002") {
    // Duplicate event.id, already processed
    return new Response("ok", { status: 200 });
  }
  throw err;
}
```

**Purpose:** Ensures exactly-once processing even under retry storms.

**C. Event Dispatch**
```typescript
await handleStripeEvent(event, log);
```

**File:** `lib/stripe/webhook-handlers.ts`

**Event Registry:**
```typescript
const handlers = {
  "checkout.session.completed": onCheckoutSessionCompleted,
  "checkout.session.async_payment_succeeded": onCheckoutAsyncPaymentSucceeded,
  "checkout.session.async_payment_failed": onCheckoutAsyncPaymentFailed,
  "checkout.session.expired": onCheckoutSessionExpired,
  "payment_intent.succeeded": onPaymentIntentSucceeded,
  "payment_intent.payment_failed": onPaymentIntentPaymentFailed,
  "charge.refunded": onChargeRefunded,
  "charge.refund.updated": onChargeRefundUpdated,
  "charge.dispute.created": onDisputeCreated,
  "charge.dispute.closed": onDisputeClosed,
};
```

**D. Event Handler Execution**

**Card Payment:** `checkout.session.completed`

**File:** `lib/stripe/handlers/checkout/completed.ts`

```typescript
if (session.payment_status === "paid") {
  await promoteBookingToConfirmed({
    bookingId,
    paymentIntentId,
    totalCostEuros,
    discountPercent,
    originalSubtotalExVatCents,
    discountedSubtotalExVatCents
  }, log);

  await createBookingJobs(bookingId, [
    { type: "issue_invoice", payload: { stripePaymentIntentId } },
    { type: "send_customer_confirmation", payload: {} },
    { type: "send_internal_confirmation", payload: {} }
  ]);
}
```

**Async Payment (MB WAY / SEPA):** `checkout.session.async_payment_succeeded`

**File:** `lib/stripe/handlers/checkout/async-payment-succeeded.ts`

Same promotion logic, triggered when async payment confirms.

**E. Booking Promotion**

**File:** `lib/stripe/webhook-service.ts` (lines 88-180)

**Function:** `promoteBookingToConfirmed(args, log)`

**Atomic Update:**
```typescript
await db.$transaction(async (tx) => {
  const existing = await tx.booking.findUnique({ where: { id: bookingId } });

  if (existing.status === BookingStatus.CONFIRMED && existing.depositPaid) {
    // Already promoted (idempotent)
    return;
  }

  await tx.booking.update({
    where: { id: bookingId },
    data: {
      status: BookingStatus.CONFIRMED,
      depositPaid: true,  // "fully paid"
      holdExpiresAt: null,  // Clear hold
      stripePaymentIntentId,
      totalCost: totalCostEuros,
      discountPercentage,
      originalSubtotalExVatCents,
      discountedSubtotalExVatCents
    }
  });
});
```

**F. Job Creation**
```typescript
await createBookingJobs(bookingId, [
  { type: "issue_invoice", payload: {...} },
  { type: "send_customer_confirmation", payload: {} },
  { type: "send_internal_confirmation", payload: {} }
]);
```

**G. Non-Blocking Job Processor Kick**
```typescript
// Fire-and-forget immediate kick (2s timeout)
fetch(`${APP_URL}/api/cron/process-booking-jobs`, {
  signal: AbortSignal.timeout(2000)
}).catch(() => {});  // Ignore errors, cron fallback handles it
```

**Purpose:** Reduce latency for email/invoice (typically <5s end-to-end).

**H. Always ACK**
```typescript
return new Response("ok", { status: 200 });
```

**Critical:** Always return 200, even on handler errors. This prevents Stripe from retrying our code bugs.

---

### 5. Payment Confirmation (Booking Promotion)

**What Changes:**
- Booking.status: PENDING → CONFIRMED
- Booking.depositPaid: false → true
- Booking.holdExpiresAt: <timestamp> → null
- Booking.stripePaymentIntentId: null → "pi_..."
- Booking.totalCost, discountPercentage, discount cents: persisted

**Jobs Created:**
- `issue_invoice` (async)
- `send_customer_confirmation` (async)
- `send_internal_confirmation` (async)

**See:** [Async Job Queue](async-jobs.md) for job processing details.

---

## Refund Handling

### Webhook Event: `charge.refunded`

**File:** `lib/stripe/handlers/charge/refunded.ts`

**Process:**
1. Extract `charge.payment_intent` to find Booking
2. Idempotency check (StripeEvent table)
3. Compute totals: `charge.amount_refunded` vs `charge.amount`
4. Determine status: FULL (100%), PARTIAL (>0%), NONE
5. Merge refund IDs: `mergeRefundIds(existing[], incoming[])`
6. Update booking:
   ```typescript
   {
     refundedAmountCents: totalRefunded,
     refundStatus: RefundStatus.FULL | PARTIAL | NONE,
     refundIds: [...mergedIds],
     stripeChargeId: charge.id
   }
   ```

**Note:** Booking.status remains CONFIRMED (refund tracking is separate).

---

## Dispute Handling

### Webhook Event: `charge.dispute.created`

**File:** `lib/stripe/handlers/charge/dispute-created.ts`

**Updates:**
```typescript
{
  disputeId: dispute.id,
  disputeStatus: DisputeStatus.OPEN,
  disputeReason: dispute.reason,
  stripeChargeId: charge.id
}
```

### Webhook Event: `charge.dispute.closed`

**File:** `lib/stripe/handlers/charge/dispute-closed.ts`

**Status Mapping:**
```typescript
"won" | "warning_closed" → DisputeStatus.WON
"lost" | "charge_refunded" → DisputeStatus.LOST
```

**Updates:**
```typescript
{
  disputeStatus: DisputeStatus.WON | LOST,
  disputeClosedAt: new Date(event.created * 1000)
}
```

---

## Idempotent Booking Reuse

**Pattern:** If same customer books same machine for same dates within 30 minutes, reuse existing PENDING booking.

**File:** `lib/repos/booking-repo.ts` (lines 182-327)

**Function:** `createOrReusePendingBooking(dto, options)`

**Algorithm:**
```
1. Enforce lead-time (if heavy machine + not bypassed)
2. Begin transaction with advisory lock on machineId
3. Query existing PENDING booking:
   - Same machineId + startDate + endDate + customerEmail
4. If found:
   - Update all fields (add-ons, contact, billing, totals, discounts)
   - Extend hold: keep old expiry if > new, else update
   - Return ID
5. Else:
   - Create new PENDING booking with holdExpiresAt = now + 30 min
   - Catch overlap error and re-throw as OverlapError
   - Return ID
```

**Why:** Prevents orphaned bookings when user refreshes form or changes add-ons.

---

## Failure Modes & Diagnostics

### Symptom: Checkout creates but booking not confirmed

**Likely Causes:**
1. Webhook not delivered (check Stripe Dashboard > Webhooks)
2. Signature verification failed (wrong STRIPE_WEBHOOK_SECRET)
3. Idempotency duplicate (event already processed)
4. Handler error (check logs for `handler_error`)

**Where to Look:**
- Stripe Dashboard > Webhooks > Event log
- Application logs: `[stripe:webhook] received`, `promote:start`, `promote:done`
- Database: `StripeEvent` table (check if eventId exists)
- Database: `Booking` table (check status, stripePaymentIntentId)

**Verification Steps:**
1. Check Stripe Dashboard for webhook delivery (200 vs 4xx/5xx)
2. Check `StripeEvent` table: `SELECT * FROM "StripeEvent" WHERE "eventId" = '<event_id>'`
3. Check booking: `SELECT status, "depositPaid", "stripePaymentIntentId" FROM "Booking" WHERE id = <id>`
4. Check logs for error stack traces

**Safe Mitigation:**
- Retry webhook delivery from Stripe Dashboard (if idempotent)
- Manually promote booking via script (if safe, verify payment intent first)

### Symptom: Stripe webhook failing (4xx/5xx)

**Likely Causes:**
1. Signature verification failure (wrong secret, replay attack)
2. Database connection issue (unavailable, timeout)
3. Code error in handler (uncaught exception)

**Where to Look:**
- Application logs: `signature_verify_failed`, `handler_error`
- Stripe Dashboard > Webhooks > Attempt details

**Verification Steps:**
1. Check STRIPE_WEBHOOK_SECRET matches Stripe Dashboard endpoint secret
2. Check database connectivity (ping, query test table)
3. Review handler code for recent changes

**Safe Mitigation:**
- Update STRIPE_WEBHOOK_SECRET if rotated
- Fix code error and redeploy
- Retry failed events from Stripe Dashboard

### Symptom: Booking stuck in PENDING despite payment

**Likely Causes:**
1. Webhook handler error (exception thrown after payment)
2. Job creation failed (database error)
3. Promotion skipped (idempotency false positive)

**Where to Look:**
- `StripeEvent` table: check if event recorded
- `Booking` table: check status, timestamps
- `BookingJob` table: check if jobs exist
- Application logs: `promote:start`, `jobs:created`

**Verification Steps:**
1. Check StripeEvent: `SELECT * FROM "StripeEvent" WHERE "bookingId" = <id>`
2. Check Booking: `SELECT * FROM "Booking" WHERE id = <id>`
3. Check Jobs: `SELECT * FROM "BookingJob" WHERE "bookingId" = <id>`

**Safe Mitigation:**
- Manually call promotion function (if payment verified in Stripe)
- Create jobs manually if missing

---

## Stripe Configuration

### Required Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `STRIPE_SECRET_KEY` | API secret key | `sk_test_...` or `sk_live_...` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Public key (client-side) | `pk_test_...` or `pk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature secret | `whsec_...` (from Dashboard) |
| `STRIPE_CLI_WEBHOOK_SECRET` | Local webhook secret | `whsec_...` (from `stripe listen`) |
| `STRIPE_TAX_RATE_PT_STANDARD` | PT VAT 23% rate ID | `txr_...` |

**Critical:** Missing `STRIPE_TAX_RATE_PT_STANDARD` throws error immediately at checkout creation.

### Tax Handling

**Why Fixed Rate:**
- Portuguese companies always use 23% standard VAT
- Fixed rate simpler than Automatic Tax
- Reduces Stripe API calls
- Avoids tax ID collection complexity

**Setup:**
1. Create "Portugal VAT 23%" tax rate in Stripe Dashboard
2. Note its ID (e.g., `txr_1Q...`)
3. Set `STRIPE_TAX_RATE_PT_STANDARD` env var

---

## Source Pointers

**Booking Flow:**
- `app/machine/[id]/page.tsx` - Machine detail page
- `components/booking/booking-form.tsx` - Booking form (client)
- `app/actions/create-checkout.ts` - Checkout creation (server action)
- `lib/repos/booking-repo.ts` - Booking repository

**Stripe Integration:**
- `lib/stripe.ts` - Stripe client singleton
- `lib/stripe/checkout.full.ts` - Checkout session builder
- `lib/stripe/create-session.ts` - Session creation wrapper
- `app/api/stripe/webhook/route.ts` - Webhook handler
- `lib/stripe/webhook-handlers.ts` - Event registry
- `lib/stripe/handlers/*` - Event-specific handlers

**Payment Confirmation:**
- `lib/stripe/webhook-service.ts` - Booking promotion logic

**Jobs:**
- `lib/jobs/create-booking-jobs.ts` - Job creation
- `lib/jobs/process-booking-jobs.ts` - Job processor

---

## Open Questions / Risks

None identified. Payment flow is stable and in production.

---

**See Also:**
- [Data Model](data-model.md) - Booking schema details
- [Async Job Queue](async-jobs.md) - Job processing
- [Invoicing](invoicing-vendus.md) - Invoice generation after payment
