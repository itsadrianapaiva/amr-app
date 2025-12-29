# Operations Runbooks

Practical troubleshooting guides for common production issues.

## Runbook 1: Stripe Webhook Failing

### Symptoms
- Bookings stuck in PENDING despite payment
- Stripe Dashboard shows webhook failures (4xx/5xx)
- Customer paid but no confirmation email

### Likely Causes
1. Signature verification failure (wrong STRIPE_WEBHOOK_SECRET)
2. Database connection issue
3. Code error in webhook handler

### Where to Look
- **Stripe Dashboard** > Webhooks > Event details
- **Application Logs**: `[stripe:webhook] signature_verify_failed`, `handler_error`
- **Database**: `StripeEvent` table (check if event recorded)

### Verification Steps
```sql
-- Check if event was recorded
SELECT * FROM "StripeEvent" WHERE "eventId" = 'evt_...';

-- Check booking status
SELECT id, status, "depositPaid", "stripePaymentIntentId"
FROM "Booking" WHERE id = <id>;
```

### Safe Mitigation
1. Verify `STRIPE_WEBHOOK_SECRET` matches endpoint secret in Stripe Dashboard
2. Check database connectivity
3. Review recent code changes to webhook handler
4. Retry failed events from Stripe Dashboard (if idempotent)
5. Manually promote booking if payment verified in Stripe (use with caution)

**Source Pointers:**
- `app/api/stripe/webhook/route.ts` - Webhook handler
- `lib/stripe/webhook-service.ts` - Booking promotion logic

---

## Runbook 2: Checkout Creates But Booking Not Confirmed

### Symptoms
- Stripe Checkout Session created successfully
- Customer redirected to success page
- Booking remains in PENDING state
- No confirmation email received

### Likely Causes
1. Webhook not delivered (check Stripe Dashboard)
2. Idempotency duplicate (event already processed, but failed)
3. Job queue stuck
4. Email sending disabled

### Where to Look
```sql
-- Check StripeEvent
SELECT * FROM "StripeEvent" WHERE "bookingId" = <id>;

-- Check Booking
SELECT status, "depositPaid", "stripePaymentIntentId",
       "confirmationEmailSentAt"
FROM "Booking" WHERE id = <id>;

-- Check Jobs
SELECT type, status, attempts, result
FROM "BookingJob" WHERE "bookingId" = <id>;
```

### Verification Steps
1. Check Stripe Dashboard > Webhooks for delivery status
2. Verify `payment_intent.succeeded` event fired
3. Check `StripeEvent` table for event record
4. Check `BookingJob` table for job creation
5. Check `Booking` timestamps for email delivery

### Safe Mitigation
1. If webhook not delivered: Retry from Stripe Dashboard
2. If jobs stuck: Reset to pending (see Job Queue Runbook)
3. If booking not promoted: Verify payment in Stripe, then manually promote
4. If emails not sent: Check SEND_EMAILS=true

**Source Pointers:**
- `lib/stripe/handlers/checkout/completed.ts` - Payment confirmation
- `lib/jobs/process-booking-jobs.ts` - Job processor

---

## Runbook 3: Vendus Invoice Not Issued

### Symptoms
- Booking confirmed but no invoice
- `invoiceNumber` is NULL
- Job status shows `failed`

### Likely Causes
1. INVOICING_ENABLED !== "true" (feature flag)
2. Vendus register closed
3. Vendus API error (permissions, auth)
4. Job queue stuck/failed

### Where to Look
```sql
-- Check invoice metadata
SELECT "invoiceProvider", "invoiceProviderId", "invoiceNumber"
FROM "Booking" WHERE id = <id>;

-- Check job status
SELECT status, attempts, result
FROM "BookingJob"
WHERE "bookingId" = <id> AND type = 'issue_invoice';
```

### Verification Steps
1. Check `INVOICING_ENABLED`: Should be `"true"`
2. Check job result field for error details
3. Log into Vendus and verify register is OPEN
4. Check `VENDUS_API_KEY` is valid
5. Verify `VENDUS_MODE` matches environment (tests vs normal)

### Safe Mitigation
1. Set `INVOICING_ENABLED=true` if disabled
2. Open Vendus register if closed (Vendus dashboard)
3. Fix Vendus API key if invalid
4. Reset job to pending:
   ```sql
   UPDATE "BookingJob"
   SET status = 'pending', attempts = 0, result = NULL
   WHERE "bookingId" = <id> AND type = 'issue_invoice';
   ```

**Source Pointers:**
- `lib/invoicing/issue-for-booking.ts` - Invoice orchestration
- `lib/invoicing/vendors/vendus/documents.ts` - Vendus API

---

## Runbook 4: Signed Invoice Link Not Working

### Symptoms
- Customer clicks PDF link, gets 403 Forbidden
- Link returns "Invalid or expired token"
- PDF download fails

### Likely Causes
1. Token expired (>72h old by default)
2. `INVOICING_LINK_SECRET` changed
3. Booking ID mismatch
4. Invoice not yet issued

### Where to Look
```sql
-- Check invoice metadata
SELECT "invoiceProviderId", "invoiceNumber", "invoicePdfUrl"
FROM "Booking" WHERE id = <id>;
```

### Verification Steps
1. Decode token payload (base64url decode middle section)
2. Check expiry: `payload.exp > now()`
3. Verify `payload.bid === bookingId`
4. Check `INVOICING_LINK_SECRET` hasn't rotated
5. Verify invoice exists in Booking record

### Safe Mitigation
1. Generate new token if expired
2. Ensure `INVOICING_LINK_SECRET` matches original secret
3. Verify invoice was issued (check invoiceProviderId)
4. Resend email with new link

**Source Pointers:**
- `lib/security/signed-links.ts` - Token generation/verification
- `app/api/invoices/[bookingId]/pdf/route.ts` - PDF proxy

---

## Runbook 5: Staging Works, Prod Broken

### Symptoms
- Feature works on staging
- Same feature fails on production
- No code changes between environments

### Likely Causes
Environment variable mismatch, mode flags, migrations not run, secrets not synced

### Environment Checklist

**Stripe:**
- `STRIPE_SECRET_KEY` is `sk_live_...` (not `sk_test_...`)
- `STRIPE_WEBHOOK_SECRET` matches prod endpoint in Stripe Dashboard
- `STRIPE_TAX_RATE_PT_STANDARD` points to prod tax rate

**Vendus:**
- `VENDUS_MODE=normal` (not "tests")
- `VENDUS_API_KEY` is production key
- Vendus register is OPEN in production

**Email:**
- `SEND_EMAILS=true`
- `RESEND_API_KEY` is valid
- `EMAIL_ADMIN_TO` points to correct admin email

**Database:**
- `RUN_MIGRATIONS=1` in netlify.toml production context
- Migrations ran successfully (check build logs)
- `DATABASE_URL` points to prod database

**Base URL:**
- `APP_URL` resolves to `https://amr-rentals.com`
- No localhost/staging URLs in prod env vars

### Safe Mitigation
1. Update mismatched env vars in Netlify UI
2. Trigger new deploy to run migrations
3. Verify mode flags match environment intent
4. Test critical flows after fix

**Source Pointers:**
- `netlify.toml` - Build contexts
- `scripts/netlify-build.js` - Migration runner

---

## Runbook 6: Job Queue Stuck

### Symptoms
- Jobs remain in `pending` state for >5 minutes
- No jobs being processed
- Emails not sending

### Likely Causes
1. Cron function disabled/not running
2. All jobs in `failed` state
3. `CRON_SECRET` mismatch
4. Database connectivity issue

### Where to Look
```sql
-- Check pending jobs
SELECT id, "bookingId", type, attempts, "createdAt"
FROM "BookingJob"
WHERE status = 'pending'
ORDER BY "createdAt" ASC LIMIT 10;

-- Check failed jobs
SELECT id, "bookingId", type, result
FROM "BookingJob"
WHERE status = 'failed'
ORDER BY "createdAt" DESC LIMIT 10;
```

### Verification Steps
1. Check Netlify Functions logs for `process-booking-jobs` execution
2. Verify cron function is enabled (Netlify UI > Functions)
3. Check `CRON_SECRET` matches in function and API route
4. Test manual trigger

### Safe Mitigation
1. Enable cron function if disabled
2. Reset failed jobs to pending
3. Fix `CRON_SECRET` mismatch
4. Check database connectivity
5. Manually trigger processor to clear backlog

**Source Pointers:**
- `netlify/functions/process-booking-jobs.ts` - Cron function
- `app/api/cron/process-booking-jobs/route.ts` - Processor API
- `lib/jobs/process-booking-jobs.ts` - Core processor

---

## General Debugging Tips

### Database Quick Checks

```sql
-- Recent bookings
SELECT id, status, "customerEmail", "createdAt"
FROM "Booking" ORDER BY "createdAt" DESC LIMIT 10;

-- Pending jobs
SELECT COUNT(*) FROM "BookingJob" WHERE status = 'pending';

-- Failed jobs (last hour)
SELECT type, COUNT(*) FROM "BookingJob"
WHERE status = 'failed' AND "createdAt" > now() - interval '1 hour'
GROUP BY type;

-- Recent webhook events
SELECT "eventId", type, "createdAt"
FROM "StripeEvent" ORDER BY "createdAt" DESC LIMIT 10;
```

---

**Last Updated:** 2025-12-29
