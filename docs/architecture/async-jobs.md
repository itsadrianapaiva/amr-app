# Async Job Queue

Documentation of the BookingJob model and async job processing system.

## Overview

The system uses a durable async job queue to decouple critical payment confirmation from slower side effects (invoice issuance, email sending). This pattern:
- Keeps webhook response times fast (<1s typical)
- Makes side effects retryable with automatic failure tracking
- Prevents external service timeouts from blocking payment confirmation
- Provides observability and auditability for background tasks

## BookingJob Model

**File:** `prisma/schema.prisma` (lines 167-190)

```prisma
model BookingJob {
  id          Int      @id @default(autoincrement())
  bookingId   Int
  booking     Booking  @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  type        String   // Job type identifier
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
  @@index([bookingId, type])   // For job lookups
}
```

### Job Types

**File:** `lib/jobs/booking-job-types.ts`

```typescript
type BookingJobType =
  | "issue_invoice"
  | "send_customer_confirmation"
  | "send_internal_confirmation"
  | "send_invoice_ready"

type BookingJobStatus = "pending" | "processing" | "completed" | "failed"
```

| Type | Purpose | Created By | Triggered By |
|------|---------|------------|--------------|
| `issue_invoice` | Issue Vendus invoice | Payment confirmation | Stripe webhook |
| `send_customer_confirmation` | Send confirmation email | Payment confirmation | Stripe webhook |
| `send_internal_confirmation` | Send ops notification | Payment confirmation | Stripe webhook |
| `send_invoice_ready` | Send invoice PDF link | Invoice issuance | `issue_invoice` job completion |

---

## Job Lifecycle

### States

```
pending
  ↓ (Claimed by processor)
processing
  ↓
completed (success) OR failed (max retries exceeded)
```

**State Transitions:**
- `pending` → `processing`: Atomic claim by processor
- `processing` → `completed`: Successful execution
- `processing` → `pending`: Retriable failure (attempts < maxAttempts)
- `processing` → `failed`: Terminal failure (attempts >= maxAttempts)

---

## Job Creation

**File:** `lib/jobs/create-booking-jobs.ts`

**Function:** `createBookingJobs(bookingId, jobs)`

### Upsert Pattern

```typescript
for (const job of jobs) {
  await db.bookingJob.upsert({
    where: {
      bookingId_type: { bookingId, type: job.type }
    },
    create: {
      bookingId,
      type: job.type,
      status: "pending",
      payload: job.payload,
      attempts: 0,
      maxAttempts: 3
    },
    update: {
      // If job exists and failed, reset to pending
      status: "pending",
      attempts: 0,
      payload: job.payload,
      result: null,
      processedAt: null
    }
  });
}
```

**Idempotency:** Unique constraint `@@unique([bookingId, type])` ensures one job per booking per type.

**Retry Reset:** If job exists in `failed` state, upsert resets to `pending` for retry.

### Created After Payment Confirmation

**File:** `lib/stripe/handlers/checkout/completed.ts`

```typescript
await promoteBookingToConfirmed({ bookingId, ... }, log);

await createBookingJobs(bookingId, [
  { type: "issue_invoice", payload: { stripePaymentIntentId } },
  { type: "send_customer_confirmation", payload: {} },
  { type: "send_internal_confirmation", payload: {} }
]);
```

**Timing:** Immediately after booking promotion (PENDING → CONFIRMED).

### Created After Invoice Issuance

**File:** `lib/invoicing/issue-for-booking.ts`

```typescript
const invoice = await vendusProvider.createInvoice(input);

// Persist metadata to booking
await db.booking.update({ where: { id }, data: { ... } });

// Create follow-up job
await createBookingJobs(bookingId, [
  { type: "send_invoice_ready", payload: {} }
]);
```

**Chain:** `issue_invoice` → invoice created → `send_invoice_ready`

---

## Job Processing

### Processor Entry Points

**1. Cron Scheduled (Netlify Function)**

**File:** `netlify/functions/process-booking-jobs.ts`

```typescript
export const handler = schedule("*/1 * * * *", async () => {
  // Every 1 minute
  const res = await fetch(`${BASE_URL}/api/cron/process-booking-jobs`, {
    headers: { "x-cron-secret": CRON_SECRET }
  });
  return { statusCode: 200 };
});
```

**2. Immediate Kick (Non-Blocking)**

**File:** `app/api/stripe/webhook/route.ts` (lines 97-104)

```typescript
// After job creation, non-blocking kick
fetch(`${APP_URL}/api/cron/process-booking-jobs`, {
  signal: AbortSignal.timeout(2000)  // 2s max
}).catch(() => {});  // Ignore errors, cron fallback
```

**Purpose:** Reduce end-to-end latency (typically <5s for invoice + email).

**Fallback:** Cron handles jobs if immediate kick fails.

### API Route Handler

**File:** `app/api/cron/process-booking-jobs/route.ts`

**Authentication:**
```typescript
const secret = req.headers.get("x-cron-secret") || url.searchParams.get("token");
if (secret !== CRON_SECRET) {
  return new Response("Unauthorized", { status: 401 });
}
```

**Delegation:**
```typescript
const result = await processBookingJobs({ maxJobs: 10 });

return NextResponse.json({
  ok: true,
  processed: result.processedCount,
  remainingPending: result.remainingPendingCount,
  asOfUtc: new Date().toISOString()
});
```

### Core Processor Logic

**File:** `lib/jobs/process-booking-jobs.ts`

**Function:** `processBookingJobs({ maxJobs })`

#### Algorithm

```typescript
1. Fetch oldest pending jobs (up to maxJobs)
   - WHERE status = "pending"
   - ORDER BY createdAt ASC
   - LIMIT maxJobs

2. For each job:
   a. Atomic claim:
      - UPDATE ... SET status = "processing", attempts = attempts + 1
      - WHERE id = job.id AND status = "pending"
      - If no rows updated → skip (already claimed)

   b. Execute job:
      - Dispatch to handler based on type
      - Catch errors, log to result field

   c. Update status:
      - Success → status = "completed", processedAt = now()
      - Retriable error (attempts < maxAttempts) → status = "pending"
      - Terminal error (attempts >= maxAttempts) → status = "failed"

3. Return metrics:
   - processedCount: number of jobs executed
   - remainingPendingCount: pending jobs after processing
```

#### Atomic Claim

```typescript
const claimed = await db.bookingJob.updateMany({
  where: {
    id: job.id,
    status: "pending"  // Predicate prevents double-claim
  },
  data: {
    status: "processing",
    attempts: { increment: 1 }
  }
});

if (claimed.count === 0) {
  continue;  // Already claimed by another worker
}
```

**Purpose:** Multiple workers can run concurrently without duplicating work.

#### Job Execution

```typescript
async function executeJob(job: BookingJob): Promise<void> {
  switch (job.type) {
    case "issue_invoice":
      await maybeIssueInvoice(job.bookingId);
      break;

    case "send_customer_confirmation":
      await notifyBookingConfirmed(job.bookingId, "customer");
      break;

    case "send_internal_confirmation":
      await notifyBookingConfirmed(job.bookingId, "ops");
      break;

    case "send_invoice_ready":
      await notifyInvoiceReady(job.bookingId);
      break;

    default:
      throw new Error(`Unknown job type: ${job.type}`);
  }
}
```

---

## Retry Logic

### Automatic Retry

**Condition:** `job.attempts < job.maxAttempts` (default 3)

**Behavior:**
```typescript
if (job.attempts < job.maxAttempts) {
  // Retriable error
  await db.bookingJob.update({
    where: { id: job.id },
    data: {
      status: "pending",  // Back to queue
      result: { error: err.message, retriedAt: new Date() }
    }
  });
} else {
  // Terminal failure
  await db.bookingJob.update({
    where: { id: job.id },
    data: {
      status: "failed",
      result: { error: err.message, failedAt: new Date() }
    }
  });
}
```

**Backoff:** Implicit via cron interval (1 minute). No exponential backoff.

### Manual Retry

**SQL:**
```sql
-- Reset failed job to pending
UPDATE "BookingJob"
SET status = 'pending', attempts = 0, result = NULL, "processedAt" = NULL
WHERE "bookingId" = <id> AND type = '<type>';
```

**Use Case:** Ops intervention after persistent failures.

---

## Job Type Details

### issue_invoice

**Handler:** `lib/invoicing/issue-for-booking.ts`

**Payload:**
```json
{
  "stripePaymentIntentId": "pi_..."
}
```

**Process:**
1. Check INVOICING_ENABLED flag
2. Load booking facts (machine, dates, customer, billing, totals)
3. Resolve Vendus client by NIF or email
4. Validate Vendus register state
5. Build document payload (FR/FT, VAT 23%, items)
6. POST to Vendus API
7. Persist invoice metadata to booking
8. Create `send_invoice_ready` job

**Failure Modes:**
- INVOICING_ENABLED=false → Skip (no-op)
- Vendus API error (register closed, permissions) → Retry up to 3x
- Network timeout → Retry

### send_customer_confirmation

**Handler:** `lib/notifications/notify-booking-confirmed.tsx`

**Target:** Customer (`booking.customerEmail`)

**Idempotency:** Atomic update `WHERE confirmationEmailSentAt IS NULL`

**Process:**
1. Load booking + machine
2. Check confirmationEmailSentAt === null (idempotency guard)
3. Build email (React Email template)
4. Send via Resend
5. Set confirmationEmailSentAt = now()

**Failure Modes:**
- Email already sent → Skip (idempotent)
- Resend API error → Retry up to 3x
- Email address invalid → Log error, mark failed

### send_internal_confirmation

**Handler:** `lib/notifications/notify-booking-confirmed.tsx`

**Target:** Ops team (`EMAIL_ADMIN_TO`)

**Idempotency:** Atomic update `WHERE internalEmailSentAt IS NULL`

**Process:**
1. Load booking + machine
2. Check internalEmailSentAt === null
3. Build internal email (ops dashboard link, flags)
4. Send to comma-separated admin emails
5. Set internalEmailSentAt = now()

**Failure Modes:**
- Email already sent → Skip
- Resend API error → Retry

### send_invoice_ready

**Handler:** `lib/notifications/notify-invoice-ready.tsx`

**Target:** Customer

**Prerequisites:**
- `invoiceNumber` populated
- `invoicePdfUrl` populated

**Idempotency:** Atomic update `WHERE invoiceEmailSentAt IS NULL`

**Process:**
1. Load booking
2. Check invoiceNumber && invoicePdfUrl (skip if missing)
3. Check invoiceEmailSentAt === null
4. Generate signed JWT token (72h TTL)
5. Build email with /api/invoices/{id}/pdf?t=<token> link
6. Send via Resend
7. Set invoiceEmailSentAt = now()

**Failure Modes:**
- Invoice not issued yet → Skip (job will retry)
- Email already sent → Skip
- Resend API error → Retry

---

## Observability

### Structured Logging

**Events:**
```json
{
  "event": "jobs:created",
  "bookingId": 42,
  "types": ["issue_invoice", "send_customer_confirmation", "send_internal_confirmation"]
}

{
  "event": "job:processing",
  "jobId": 123,
  "bookingId": 42,
  "type": "issue_invoice",
  "attempts": 1
}

{
  "event": "job:completed",
  "jobId": 123,
  "bookingId": 42,
  "type": "issue_invoice",
  "durationMs": 1234
}

{
  "event": "job:failed",
  "jobId": 123,
  "bookingId": 42,
  "type": "issue_invoice",
  "error": "Vendus API error...",
  "attempts": 3
}
```

### Database Inspection

**Pending Jobs:**
```sql
SELECT id, "bookingId", type, attempts, "createdAt"
FROM "BookingJob"
WHERE status = 'pending'
ORDER BY "createdAt" ASC;
```

**Failed Jobs:**
```sql
SELECT id, "bookingId", type, attempts, result, "createdAt"
FROM "BookingJob"
WHERE status = 'failed'
ORDER BY "createdAt" DESC;
```

**Job History for Booking:**
```sql
SELECT type, status, attempts, result, "processedAt"
FROM "BookingJob"
WHERE "bookingId" = <id>
ORDER BY "createdAt" ASC;
```

---

## Failure Modes & Diagnostics

### Symptom: Job queue stuck

**Likely Causes:**
1. All jobs in `failed` state (max retries exceeded)
2. Cron function disabled/not running
3. Job processor error (uncaught exception)
4. Database connectivity issue

**Where to Look:**
- Database: `BookingJob` table (status, attempts, result)
- Netlify Functions logs: `process-booking-jobs` execution
- Application logs: `job:processing`, `job:completed`, `job:failed`

**Verification Steps:**
1. Check pending jobs: `SELECT COUNT(*) FROM "BookingJob" WHERE status = 'pending'`
2. Check failed jobs: `SELECT * FROM "BookingJob" WHERE status = 'failed'`
3. Check cron function logs (Netlify dashboard)
4. Check processor API route logs

**Safe Mitigation:**
- Reset failed jobs to pending (see Manual Retry above)
- Verify cron function is enabled in Netlify
- Fix code error and redeploy
- Check database connectivity

### Symptom: Emails not sending

**Likely Causes:**
1. Job status = `failed` (Resend API error)
2. Email timestamp already set (idempotent skip)
3. SEND_EMAILS !== "true" (dry-run mode)
4. Resend API key invalid/expired

**Where to Look:**
- `BookingJob` table: result field for error details
- `Booking` table: email timestamps (confirmationEmailSentAt, etc.)
- Application logs: `email:sent`, `email:skipped`, `email:error`

**Verification Steps:**
1. Check job result: `SELECT result FROM "BookingJob" WHERE "bookingId" = <id> AND type = 'send_customer_confirmation'`
2. Check booking: `SELECT "confirmationEmailSentAt", "invoiceEmailSentAt" FROM "Booking" WHERE id = <id>`
3. Check SEND_EMAILS: `echo $SEND_EMAILS`
4. Check Resend API key validity

**Safe Mitigation:**
- Set SEND_EMAILS=true if disabled
- Update Resend API key if invalid
- Reset email timestamp to NULL to resend
- Reset job to pending

---

## Source Pointers

**Job Model:**
- `prisma/schema.prisma` - BookingJob model definition

**Job Types:**
- `lib/jobs/booking-job-types.ts` - Type definitions

**Job Creation:**
- `lib/jobs/create-booking-jobs.ts` - Job creation with upsert

**Job Processing:**
- `lib/jobs/process-booking-jobs.ts` - Core processor logic
- `app/api/cron/process-booking-jobs/route.ts` - API route handler
- `netlify/functions/process-booking-jobs.ts` - Netlify scheduled function

**Job Handlers:**
- `lib/invoicing/issue-for-booking.ts` - issue_invoice
- `lib/notifications/notify-booking-confirmed.tsx` - send_*_confirmation
- `lib/notifications/notify-invoice-ready.tsx` - send_invoice_ready

**Webhook Trigger:**
- `lib/stripe/handlers/checkout/completed.ts` - Job creation after payment

---

## Open Questions / Risks

None identified. Job queue is stable and in production.

---

**See Also:**
- [Booking & Payments](booking-and-payments.md) - Payment flow triggers jobs
- [Invoicing](invoicing-vendus.md) - issue_invoice job details
- [Notifications & Email](notifications-email.md) - Email job details
