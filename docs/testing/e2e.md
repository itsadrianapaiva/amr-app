# E2E Testing (Playwright)

End-to-end testing documentation for the AMR platform.

## Overview

E2E tests use Playwright to test critical flows against a full Netlify dev server. Tests bypass authentication using the `x-e2e-secret` header.

**Tool:** Playwright
**Server:** Netlify dev (port 8888)
**Browser:** Chromium only
**Auth Bypass:** x-e2e-secret header

## Configuration

**File:** `playwright.config.ts`

### Server Mode

**USE_EXTERNAL_SERVER:**
- `USE_EXTERNAL_SERVER=1`: Reuse manually-started server
- Default: Auto-start `npx netlify dev --port 8888`

### Base URL Resolution

Priority order:
1. `APP_URL`
2. `NEXT_PUBLIC_APP_URL`
3. Default: `http://127.0.0.1:8888`

### E2E Header Injection

```typescript
use: {
  extraHTTPHeaders: {
    "x-e2e-secret": process.env.E2E_SECRET || ""
  }
}
```

**Purpose:** Bypass middleware auth for all requests

---

## Running Tests

### Local

```bash
# Clean database first
npm run db:clean

# Run E2E tests (chromium only)
npm run test:e2e

# With HTML report
npm run test:e2e:all

# Clean + run
npm run test:e2e:all:clean
```

### CI

```bash
dotenv -e .env.e2e.local -- playwright test --reporter=html,line
```

---

## Test Patterns

### Payment Flow Test

**File:** `e2e/card-happy.spec.ts`

**Pattern:**
1. Create PENDING booking via `/api/dev/create-booking`
2. Construct Stripe webhook event with valid signature
3. POST to `/api/stripe/webhook`
4. Poll `/api/dev/inspect-booking` for status change
5. Assert PENDING → CONFIRMED

**Signature Generation:**
```typescript
const signature = Stripe.webhooks.generateTestHeaderString({
  payload,
  secret: SIGNING_SECRET
});
```

### Auth Bypass Test

**File:** `e2e/ops-guard.spec.ts`

**Pattern:**
```typescript
// With E2E header (should pass)
const res = await request.get("/ops-admin");

// Without header (should redirect to login)
const ctx = await pwRequest.newContext({ baseURL }); // No extraHTTPHeaders
const resNoHeader = await ctx.get("/ops-admin");
```

### Invoice Proxy Test

**File:** `e2e/invoice-proxy.spec.ts`

**Pattern:**
1. Call `/api/dev/invoice-link?bookingId=<id>&ttl=600`
2. Extract signed URL from response
3. GET signed URL
4. Verify 200 + `application/pdf` content-type
5. Check PDF magic header (`%PDF-`)

---

## Dev-Gated Routes

**Middleware Protection:** `middleware.ts`

Routes protected in production:
- `/dev/*`
- `/api/dev/*`

**Access Control:**
1. **E2E Header** (first priority): `x-e2e-secret === E2E_SECRET` → Allow
2. **Host Check**: If prod-like host && no E2E header → 404
3. **Non-Prod Hosts**: Allow unrestricted

**Dev Routes:**
- `/api/dev/create-booking` - Create PENDING booking
- `/api/dev/inspect-booking` - Inspect booking state
- `/api/dev/invoice-link` - Generate signed token
- `/api/dev/geofence-check` - Test geofencing
- `/api/dev/ops-flags` - Inspect ops config

**Source:** `app/api/dev/*`

---

## Test Database Management

### Cleanup Script

**File:** `scripts/ops-behavior-smoke.ts`

```bash
# Delete all bookings
npm run db:clean

# Equivalent to:
npx tsx scripts/ops-behavior-smoke.ts --blank
```

**Purpose:** Reset to blank state before E2E runs

### Database Seeding

```bash
# Seed machines from CSV
npm run db:seed

# Reset and seed
SEED_RESET=1 npm run db:seed
```

---

## Environment Setup

### Required: `.env.e2e.local`

```bash
E2E_SECRET=your_test_secret_here
STRIPE_WEBHOOK_SECRET=whsec_test_...
DATABASE_URL=postgres://...
APP_URL=http://localhost:8888
# ... other env vars
```

**Note:** Must match E2E_SECRET in app environment

---

## Common Issues

### Issue: Playwright fails to start server

**Symptom:** `Exit code: 1` during webServer start

**Cause:** Port 8888 already in use

**Fix:**
```bash
# Kill process on port 8888
npx kill-port 8888

# Or use external server mode
USE_EXTERNAL_SERVER=1 npm run test:e2e
```

### Issue: Auth bypass not working

**Symptom:** Tests get 404 on `/api/dev/*` routes

**Cause:** E2E_SECRET mismatch

**Fix:** Verify `.env.e2e.local` matches app environment

---

## Source Pointers

**Configuration:**
- `playwright.config.ts` - Playwright setup
- `middleware.ts` - Dev route protection

**Tests:**
- `e2e/card-happy.spec.ts` - Payment flow
- `e2e/ops-guard.spec.ts` - Auth bypass
- `e2e/invoice-proxy.spec.ts` - Invoice links
- `e2e/holds-expiry.spec.ts` - Booking expiry
- `e2e/geofence-api.spec.ts` - Geofencing

**Helpers:**
- `tests/helpers/stripe-webhook.ts` - Webhook signing

---

**Last Updated:** 2025-12-29
