# API Routes Reference

Complete inventory of all API routes in the AMR platform.

## Customer-Facing APIs

### GET /api/check-discount

Check company discount by NIF.

**Query Params:** `nif=<string>`

**Returns:** `{ discountPercentage: number }`

**Source:** `app/api/check-discount/route.ts`

---

## Webhooks

### POST /api/stripe/webhook

Stripe webhook handler.

**Headers:** `stripe-signature` (required)

**Body:** Stripe event JSON

**Auth:** Signature verification

**Returns:** `200 "ok"` (always)

**Source:** `app/api/stripe/webhook/route.ts`

---

## Invoice Proxy

### GET /api/invoices/[bookingId]/pdf

Serve invoice PDF via signed link.

**Query Params:** `t=<signed_token>` (required)

**Auth:** JWT token verification

**Returns:** PDF stream or 403/404

**Source:** `app/api/invoices/[bookingId]/pdf/route.ts`

---

## Cron Endpoints

### GET /api/cron/expire-holds

Cancel expired PENDING bookings.

**Auth:** `x-cron-secret` header or `?token=` param

**Returns:** `{ ok: true, cancelled: number }`

**Source:** `app/api/cron/expire-holds/route.ts`

### GET /api/cron/process-booking-jobs

Process async job queue.

**Auth:** `x-cron-secret` header or `?token=` param

**Returns:** `{ ok: true, processed: number, remainingPending: number }`

**Source:** `app/api/cron/process-booking-jobs/route.ts`

---

## Dev-Gated Routes (Protected in Production)

**Auth:** Requires `x-e2e-secret` header in production

### POST /api/dev/create-booking

Create PENDING booking for testing.

**Body/Query:** Machine, dates, customer info

**Returns:** `{ ok: true, bookingId, status, holdExpiresAt }`

**Source:** `app/api/dev/create-booking/route.ts`

### GET /api/dev/inspect-booking

Inspect booking state.

**Query:** `id=<bookingId>`

**Returns:** `{ id, status, depositPaid, ... }`

**Source:** `app/api/dev/inspect-booking/route.ts`

### GET /api/dev/invoice-link

Generate signed invoice link.

**Query:** `bookingId=<id>&ttl=<seconds>`

**Returns:** `{ url: string }`

**Source:** `app/api/dev/invoice-link/route.ts`

### Other Dev Routes

- `/api/dev/checkout-for-booking` - Create Stripe session
- `/api/dev/issue-invoice` - Manually issue invoice
- `/api/dev/invoice-proxy-health` - Health check
- `/api/dev/geofence-check` - Test geofencing
- `/api/dev/ops-flags` - Inspect ops config
- `/api/dev/ops-verify-password` - Test password

**Source:** `app/api/dev/*`

---

## Ops Admin

### GET /api/ops-admin/health

Health check for ops dashboard.

**Auth:** Session cookie

**Returns:** `{ ok: true }`

**Source:** `app/api/ops-admin/health/route.ts`

---

## Other

### GET /api/env-check

Environment variable checker.

**Returns:** Diagnostic JSON

**Source:** `app/api/env-check/route.ts`

### POST /api/revalidate-after-confirm

ISR revalidation trigger.

**Source:** `app/api/revalidate-after-confirm/route.ts`

---

**Last Updated:** 2025-12-29
