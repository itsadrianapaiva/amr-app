# Notifications & Email

Documentation of the email infrastructure and notification system.

## Overview

The system sends transactional emails via Resend API using React Email templates. Emails are triggered asynchronously via the job queue with atomic timestamp guards for idempotency.

**Provider:** Resend
**Templates:** React Email (TSX components)
**Delivery:** Async via BookingJob queue
**Idempotency:** Database timestamp guards

## Email Infrastructure

### Resend Integration

**File:** `lib/emails/mailer.ts`

**Configuration:**
```typescript
const ENABLED = !!API_KEY && !!FROM && SEND_FLAG === "true";

// Environment Variables:
// - RESEND_API_KEY (required)
// - EMAIL_FROM (required, e.g., "noreply@amr-rentals.com")
// - EMAIL_REPLY_TO (optional)
// - SEND_EMAILS=true (feature flag)
```

**Singleton Client:**
```typescript
const resend = new Resend(API_KEY);
```

**Function:** `sendEmail(req: MailRequest)`

**Returns:** `Promise<{ ok: true; id?: string } | { ok: false; error: string }>`

### Dry-Run Mode

**When Disabled:**
- Missing RESEND_API_KEY
- Missing EMAIL_FROM
- SEND_EMAILS !== "true"

**Behavior:**
```typescript
if (!ENABLED) {
  console.log("[email:dry-run]", { to, subject, from });
  return { ok: true };  // Fake success
}
```

**Purpose:** Safe testing without sending real emails.

### React Email Rendering

**Process:**
```typescript
import { render } from "@react-email/render";

const html = render(<EmailTemplate {...props} />);
const text = htmlToText(html);  // Regex-based fallback

await resend.emails.send({
  from: EMAIL_FROM,
  to,
  subject,
  html,
  text,
  reply_to: EMAIL_REPLY_TO
});
```

**File:** `lib/emails/mailer.ts` (lines 50-85)

---

## Email Templates

### Customer Confirmation Email

**File:** `lib/emails/templates/booking-confirmed.tsx`

**Purpose:** Sent after payment confirmation

**Content:**
- Booking summary (machine, dates, rental days)
- Pricing breakdown (subtotal, discount, VAT, total)
- Add-ons selected (delivery, pickup, insurance, operator)
- Site address (if delivery/pickup)
- Optional invoice link (if invoicePdfUrl available)
- Support contact information

**Builder:** `lib/notifications/mailers/customer-confirmed.tsx`

**Function:** `buildCustomerEmail(view)`

**View Data:**
```typescript
{
  booking: Booking,
  machine: Machine,
  rentalDays: number,
  subtotal: Decimal,
  discount: Decimal,
  vat: Decimal,
  total: Decimal,
  invoiceLink?: string
}
```

### Invoice Ready Email

**File:** `lib/emails/templates/invoice-ready.tsx`

**Purpose:** Sent when invoice PDF is ready

**Content:**
- Brief notification that invoice is available
- Signed download link (72h TTL)
- Booking reference number
- Support contact

**Builder:** `lib/notifications/notify-invoice-ready.tsx`

**Link Generation:**
```typescript
const token = createSignedToken({ bid: bookingId }, TTL_SECONDS);
const link = `${baseUrl}/api/invoices/${bookingId}/pdf?t=${encodeURIComponent(token)}`;
```

### Internal (Ops) Email

**File:** `lib/emails/templates/booking-internal.tsx`

**Purpose:** Ops notification after payment

**Content:**
- Booking ID and status
- Customer contact details
- Machine and dates
- Delivery/pickup flags
- Geofence status
- Heavy machine lead time flags
- Stripe payment intent ID
- Link to ops dashboard

**Builder:** `lib/notifications/mailers/internal-confirmed.tsx`

**Recipients:** `EMAIL_ADMIN_TO` (comma-separated)

---

## Notification Triggers

### After Payment Confirmation

**File:** `lib/stripe/handlers/checkout/completed.ts`

```typescript
await createBookingJobs(bookingId, [
  { type: "send_customer_confirmation", payload: {} },
  { type: "send_internal_confirmation", payload: {} }
]);
```

**Timing:** Immediately after `promoteBookingToConfirmed()`

### After Invoice Issuance

**File:** `lib/invoicing/issue-for-booking.ts`

```typescript
// After Vendus API returns invoice
await createBookingJobs(bookingId, [
  { type: "send_invoice_ready", payload: {} }
]);
```

**Timing:** After invoice metadata persisted to Booking

---

## Email Sending (Job Handlers)

### Customer Confirmation Handler

**File:** `lib/notifications/notify-booking-confirmed.tsx`

**Function:** `notifyBookingConfirmed(bookingId, source: "customer" | "ops")`

#### Process (source="customer"):

```typescript
1. Load booking + machine from DB

2. Idempotency check:
   const updated = await db.booking.updateMany({
     where: { id: bookingId, confirmationEmailSentAt: null },
     data: { confirmationEmailSentAt: now() }
   });
   if (updated.count === 0) return;  // Already sent

3. Build view data:
   - Compute rental days, totals
   - Format dates (Lisbon timezone)
   - Build invoice link if available

4. Build email template:
   const email = await buildCustomerEmail(view);

5. Send via Resend:
   await sendEmail({ to: customerEmail, subject: "...", email });
```

**Atomic Timestamp Update:**
```sql
UPDATE "Booking"
SET "confirmationEmailSentAt" = now()
WHERE id = <id> AND "confirmationEmailSentAt" IS NULL;
```

**Purpose:** Only the first caller (race condition winner) sends the email.

### Internal Confirmation Handler

**Same function, source="ops":**

```typescript
1. Load booking + machine

2. Idempotency check (internalEmailSentAt)

3. Build internal email (ops view)

4. Send to EMAIL_ADMIN_TO (comma-separated list)

5. Set internalEmailSentAt
```

### Invoice Ready Handler

**File:** `lib/notifications/notify-invoice-ready.tsx`

```typescript
1. Load booking

2. Prerequisites check:
   if (!booking.invoiceNumber || !booking.invoicePdfUrl) {
     return;  // Skip, invoice not ready
   }

3. Idempotency check (invoiceEmailSentAt)

4. Generate signed token (72h TTL)

5. Build email with PDF link

6. Send via Resend

7. Set invoiceEmailSentAt
```

---

## Email Tracking Timestamps

**Booking Model Fields:**

| Field | Purpose |
|-------|---------|
| `confirmationEmailSentAt` | Customer confirmation sent |
| `invoiceEmailSentAt` | Invoice ready email sent |
| `internalEmailSentAt` | Ops notification sent |

**Type:** `DateTime? @db.Timestamp(6)` (nullable, microsecond precision)

**Usage:**
- Idempotency guards (only send if NULL)
- Audit trail (know when emails dispatched)

---

## Email Branding

**File:** `lib/emails/branding.ts`

**Function:** `getEmailBranding()`

**Returns:**
```typescript
{
  companyName: string,
  supportEmail: string,
  supportPhone: string,
  warehouseAddress?: string,
  warehouseHours?: string
}
```

**Resolution Order:**
1. Content module (`lib/content/contacts`)
2. Environment variables (COMPANY_NAME, SUPPORT_EMAIL, etc.)
3. Hardcoded defaults

**Validation:** Production requires ADMIN_TO or EMAIL_ADMIN_TO.

---

## Failure Modes & Diagnostics

### Symptom: Emails not sending

**Likely Causes:**
1. SEND_EMAILS !== "true" (dry-run mode)
2. RESEND_API_KEY missing/invalid
3. Email timestamp already set (idempotent skip)
4. Job status = failed (max retries exceeded)

**Where to Look:**
- Application logs: `[email:dry-run]`, `email:sent`, `email:error`
- Database: Booking email timestamps
- Database: BookingJob status and result
- Resend Dashboard: Email delivery logs

**Verification Steps:**
```sql
-- Check timestamps
SELECT "confirmationEmailSentAt", "invoiceEmailSentAt", "internalEmailSentAt"
FROM "Booking" WHERE id = <id>;

-- Check job status
SELECT status, attempts, result FROM "BookingJob"
WHERE "bookingId" = <id> AND type LIKE 'send_%';
```

**Safe Mitigation:**
- Set SEND_EMAILS=true
- Update RESEND_API_KEY
- Reset timestamp to NULL to resend
- Reset job to pending

### Symptom: Duplicate emails sent

**Likely Causes:**
1. Timestamp guard not working (race condition)
2. Manual retry without checking timestamp

**Prevention:** Atomic `updateMany` with `WHERE timestamp IS NULL` prevents duplicates.

**Verification:**
```sql
SELECT "confirmationEmailSentAt", COUNT(*)
FROM "Booking"
GROUP BY "confirmationEmailSentAt"
HAVING COUNT(*) > 1;
```

---

## Source Pointers

**Email Infrastructure:**
- `lib/emails/mailer.ts` - Resend client, sendEmail function
- `lib/emails/branding.ts` - Company branding resolution

**Templates:**
- `lib/emails/templates/booking-confirmed.tsx` - Customer confirmation
- `lib/emails/templates/invoice-ready.tsx` - Invoice ready
- `lib/emails/templates/booking-internal.tsx` - Ops notification

**Builders:**
- `lib/notifications/mailers/customer-confirmed.tsx` - Customer email builder
- `lib/notifications/mailers/internal-confirmed.tsx` - Internal email builder

**Notification Handlers:**
- `lib/notifications/notify-booking-confirmed.tsx` - Confirmation emails
- `lib/notifications/notify-invoice-ready.tsx` - Invoice ready email

**Job Processing:**
- `lib/jobs/process-booking-jobs.ts` - Job processor (calls handlers)

**Triggers:**
- `lib/stripe/handlers/checkout/completed.ts` - After payment
- `lib/invoicing/issue-for-booking.ts` - After invoice

---

## Open Questions / Risks

None identified. Email system is stable and in production.

---

**See Also:**
- [Async Job Queue](async-jobs.md) - Email job processing
- [Booking & Payments](booking-and-payments.md) - Payment triggers emails
- [Invoicing](invoicing-vendus.md) - Invoice triggers email
