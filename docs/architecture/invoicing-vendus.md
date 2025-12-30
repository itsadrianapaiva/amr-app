# Invoicing (Vendus Integration)

Complete documentation of the Vendus API integration for Portuguese tax-compliant invoicing.

## Overview

The system integrates with Vendus API (v1.1) to issue invoices after payment confirmation. Invoices are delivered to customers via time-limited signed links that proxy PDF access through the application.

**Provider:** Vendus (Portuguese invoicing SaaS)
**Trigger:** Payment confirmation via Stripe webhook
**Delivery:** Async job queue + email notification

## Invoice Issuance Trigger

### Event Flow

```
Stripe Webhook (payment_intent.succeeded)
   ↓
promoteBookingToConfirmed()
   ↓
createBookingJobs([
  { type: "issue_invoice", payload: { stripePaymentIntentId } },
  ...
])
   ↓ (Cron every 1 min + immediate kick)
   ↓
processBookingJobs()
   ↓
maybeIssueInvoice(bookingId)
   ↓
vendusProvider.createInvoice(input)
   ↓
Persist invoice metadata to Booking
   ↓
Create new job: { type: "send_invoice_ready" }
```

**Files:**
- `lib/stripe/handlers/checkout/completed.ts` - Job creation after payment
- `lib/jobs/process-booking-jobs.ts` - Job processor
- `lib/invoicing/issue-for-booking.ts` - Invoice orchestration
- `lib/invoicing/vendors/vendus/index.ts` - Vendus provider implementation

---

## Vendus API Integration (v1.1)

### Base URL Resolution

**Environment Variables:**
- `VENDUS_BASE_URL` (preferred)
- `VENDUS_URL` (legacy)
- Default: `https://www.vendus.pt/ws`

**Normalization:** Trailing slash removed.

**File:** `lib/invoicing/vendors/vendus/core.ts` (lines 40-56)

### Authentication

**Method:** HTTP Basic Auth
```
Authorization: Basic ${base64(apiKey:"")}
```

**API Key:** Username
**Password:** Empty string (colon still required)

**Environment Variable:** `VENDUS_API_KEY` (required)

**File:** `lib/invoicing/vendors/vendus/core.ts` (lines 103-106)

```typescript
function authHeader(): string {
  const token = Buffer.from(`${getApiKey()}:`).toString("base64");
  return `Basic ${token}`;
}
```

### Mode Selection

**Environment Variable:** `VENDUS_MODE`
- `"tests"` - Sandbox mode (default)
- `"normal"` - Production mode

**Impact:**
- `tests`: AT (tax authority) communications disabled
- `normal`: Live invoices, AT comms enabled

**File:** `lib/invoicing/vendors/vendus/core.ts` (line 47)

---

## Document Types

**Supported Document Types:**

| Type | Name | Fiscal | Description |
|------|------|--------|-------------|
| FR | Recibo | Non-fiscal | Receipt (default fallback) |
| FT | Fatura | Fiscal | Invoice (production) |
| PF | Pro-forma | Proposal | Can be issued when register closed |
| NC | Nota de Crédito | Fiscal | Credit note |

**Environment Variable:** `VENDUS_DOC_TYPE`
- Default: `"FR"`
- Production: Set to `"FT"`

**File:** `lib/invoicing/vendors/vendus/core.ts` (line 48)

---

## Document Creation Flow

### Step 1: Resolve Client

**Endpoint:** `GET /v1.1/clients/?fiscal_id=<nif>&status=active`

**Strategy:**
1. Try lookup by fiscal_id (Portuguese NIF)
2. If ambiguous/not found, try email
3. If still not found, try name
4. If no match, POST to create new client

**File:** `lib/invoicing/vendors/vendus/clients.ts`

**Create Client Payload:**
```json
{
  "mode": "tests" | "normal",
  "name": "Customer Name",
  "email": "customer@example.com",
  "fiscal_id": "123456789",  // Optional
  "address": "Street, City, Postal Code, Country",
  "phone": "+351934014611"
}
```

**Returns:** `{ id: number }`

### Step 2: Validate Register

**Endpoint:** `GET /v1.1/registers/<id>/`

**Check:**
- Register exists
- Register is `is_active: true`
- Register state is `OPEN` (for FR/FT/NC; PF doesn't require open register)

**File:** `lib/invoicing/vendors/vendus/registers.ts`

**Error Cases:**
- Closed register → Error: "Vendus register {id} is CLOSED. Open a POS session in Vendus to issue FR/FT/NC documents."
- Inactive register → Error: "Vendus register {id} is inactive. Activate it in Vendus settings."

### Step 3: Build Document Payload

**Endpoint:** `POST /v1.1/documents/`

**File:** `lib/invoicing/vendors/vendus/payload.ts`

**Payload Structure:**
```json
{
  "type": "FT" | "FR" | "PF" | "NC",
  "mode": "tests" | "normal",
  "date": "YYYY-MM-DD",  // Lisbon timezone
  "register_id": 123,
  "client": { "id": 456 },
  "items": [
    {
      "title": "Machine Name — 3 day(s) rental 2025-09-30 → 2025-10-02",
      "qty": 3,
      "gross_price": 121.77,  // Unit price INCLUDING VAT
      "tax_id": "NOR",  // VAT enum
      "reference": "machine-code",
      "tax_exemption_law": null  // Only for ISE (0% VAT)
    }
  ],
  "external_reference": "Booking #123",
  "notes": "Payment via Stripe: pi_...",
  "output": "pdf_url",
  "return_qrcode": 1
}
```

### Step 4: Receive Response

**Response:**
```json
{
  "id": 789,  // Vendus internal document ID
  "full_number": "FT T01P2025/1",
  "number": "1",
  "atcud": "ABCD1234-1",  // May be null if series not configured
  "pdf_url": "https://www.vendus.pt/.../document.pdf",
  "output_url": "https://www.vendus.pt/.../document.pdf",
  "qrcode_data": "..."
}
```

### Step 5: Persist Metadata

**File:** `lib/invoicing/issue-for-booking.ts`

**Update Booking:**
```typescript
await db.booking.update({
  where: { id: bookingId },
  data: {
    invoiceProvider: "vendus",
    invoiceProviderId: String(result.id),
    invoiceNumber: result.full_number || result.number,
    invoicePdfUrl: result.pdf_url || result.output_url,
    invoiceAtcud: result.atcud
  }
});
```

**Unique Constraint:** `@@unique([invoiceProvider, invoiceProviderId])`

---

## VAT Handling

### VAT Rate Mapping

**Portugal VAT Rates:**

| Rate | Vendus ID | Description |
|------|-----------|-------------|
| 23% | NOR | Normal rate (standard) |
| 13% | INT | Intermediate rate |
| 6% | RED | Reduced rate |
| 0% | ISE | Exempt (requires tax_exemption_law) |

**File:** `lib/invoicing/vendors/vendus/payload.ts` (lines 45-59)

**Current Implementation:** Hardcoded 23% (NOR)

**Future:** Make configurable per item/machine.

### Gross Price Calculation

**Unit price = net + VAT (inclusive)**

```typescript
gross_price = tax_id === "ISE"
  ? net_price_cents / 100
  : (net_price_cents / 100) * (1 + vatPercent / 100)
```

**Example:**
- Net: €99.00
- VAT: 23%
- Gross: €99.00 × 1.23 = €121.77

**Note:** Vendus API expects gross_price (inclusive), not net.

---

## Signed Invoice Links (JWT Tokens)

### Purpose

Provide time-limited public access to invoice PDFs without exposing Vendus credentials.

### Token Generation

**File:** `lib/security/signed-links.ts`

**Function:** `createSignedToken(payload, ttlSeconds)`

**Token Format:** `v1.{base64url(payload)}.{hex(hmac-sha256)}`

**Payload:**
```json
{
  "bid": 123,  // Booking ID
  "exp": 1703001600,  // Unix seconds (expiry)
  "v": 1  // Version
}
```

**TTL:**
- Default: 72 hours (259,200 seconds)
- Override: `INVOICE_LINK_TTL_SECONDS` env var

**Secret:**
- Environment Variable: `INVOICING_LINK_SECRET`
- Minimum: 24 characters (enforced at runtime)

**File:** `lib/invoicing/invoice-links.ts` (lines 118-141)

### Token Verification

**File:** `lib/security/signed-links.ts`

**Function:** `verifySignedToken(token, secret)`

**Steps:**
1. Split by `.` (must be 3 parts)
2. Verify version === `v1`
3. Decode payload (base64url)
4. Compute HMAC-SHA256 of `v1.{payload}` with secret
5. Compare signatures (constant-time via `timingSafeEqual`)
6. Check expiry: `payload.exp > now()`

**Returns:**
- Success: `{ bid: number, exp: number, v: number }`
- Failure: `null`

### URL Construction

**Format:** `GET /api/invoices/{bookingId}/pdf?t={urlEncodedToken}`

**Example:**
```
https://amr-rentals.com/api/invoices/42/pdf?t=v1.eyJiaWQiOjQyLCJleHAiOjE3MDMwMDEwMDB9.abc123...
```

---

## PDF Proxy Route

**Route:** `/api/invoices/[bookingId]/pdf`

**File:** `app/api/invoices/[bookingId]/pdf/route.ts`

### Request Flow

```
GET /api/invoices/42/pdf?t=v1.eyJ...
   ↓
1. Extract bookingId from path param
2. Extract token from query param
3. Verify token signature + expiry
4. Check bookingId matches payload.bid
   ↓ [403 if invalid/expired]
   ↓
5. Load booking from DB
   ↓ [404 if not found]
   ↓
6. Resolve PDF URL:
   - Use invoicePdfUrl if stored
   - Else construct: {VENDUS_BASE_URL}/v1.1/documents/{invoiceProviderId}.pdf
   ↓ [502 if no URL available]
   ↓
7. Attempt authenticated streaming:
   - Add mode param if Vendus URL
   - Build HTTP Basic auth header
   - Fetch with accept: application/pdf
   - Check content-type === application/pdf
   - Stream body with Content-Disposition: inline
   ↓ [Fallback: redirect if fetch fails]
   ↓
8. Return PDF with cache headers:
   - cache-control: no-store, max-age=0
   - content-type: application/pdf
   - content-disposition: inline; filename="..."
```

### Filename Sanitization

**File:** `app/api/invoices/[bookingId]/pdf/route.ts` (lines 94-103)

**Pattern:**
```typescript
const sanitized = invoiceNumber
  ?.replace(/[^A-Za-z0-9._-]+/g, "_")
  .slice(0, 80);

const filename = sanitized || `booking-${bookingId}.pdf`;
```

**Example:**
- Input: `FT T01P2025/123`
- Output: `FT_T01P2025_123.pdf`

### Cache Headers

**All Responses:**
```
cache-control: no-store, max-age=0
```

**PDF Responses (Additional):**
```
cache-control: private, no-store
content-disposition: inline; filename="FT_T01P2025_123.pdf"
x-filename-hint: FT_T01P2025_123.pdf
```

**Purpose:** Prevent browser/CDN caching of time-sensitive invoice links.

---

## Fallback Behaviors

### Missing PDF URL in Response

**Scenario:** Vendus returns `{ id, pdf_url: null }`

**Fallback:**
```typescript
const fallbackUrl = `${VENDUS_BASE_URL}/v1.1/documents/${providerId}.pdf`;
```

**File:** `lib/invoicing/vendors/vendus/documents.ts`

### Network/Auth Failures

**Scenario:** PDF fetch fails (timeout, 401, 500)

**Fallback:** Redirect to Vendus direct URL
```typescript
const redirectUrl = new URL(pdfUrl);
redirectUrl.searchParams.set("mode", VENDUS_MODE);
// Optional: append ?api_key=... if VENDUS_FORCE_QUERY_AUTH=1
return NextResponse.redirect(redirectUrl);
```

**Note:** Browser may show auth prompt if credentials don't work.

### Job Retry Logic

**Scenario:** Invoice issuance fails (Vendus API error)

**Behavior:**
- Job marked `status: "pending"`, `attempts: 1`
- Retried up to `maxAttempts: 3`
- Error logged to `result` field
- After max retries → `status: "failed"`

**File:** `lib/jobs/process-booking-jobs.ts`

### Feature Flag Bypass

**Environment Variable:** `INVOICING_ENABLED`

**Default:** `"true"` (per .env.example)

**Behavior:**
```typescript
if (process.env.INVOICING_ENABLED !== "true") {
  return null;  // Skip invoice issuance
}
```

**File:** `lib/invoicing/issue-for-booking.ts` (line 46)

---

## Error Handling & Diagnostics

### HTTP Error Messages

**File:** `lib/invoicing/vendors/vendus/core.ts`

**Format:**
```
Vendus API error at {path}: {message} - body: {snippet(raw)}
(ctx: method={method} path={path} mode={MODE} docType={DOC_TYPE} contentType={ct}).
Hint: [helpful hint for 403, etc]
```

**Error Details:**
- Prefers Vendus structured message (`error` or `message` fields)
- Falls back to HTTP status code
- Includes request context (method, path, mode, doc type)
- Truncates response body (max 400 chars + "[truncated]")

### Common Error Scenarios

| Scenario | Error | Resolution |
|----------|-------|------------|
| Missing API key | "Missing VENDUS_API_KEY env" | Set VENDUS_API_KEY |
| Register closed | "Vendus register {id} is CLOSED. Open a POS session..." | Open Vendus register |
| Register inactive | "Vendus register {id} is inactive. Activate it..." | Activate in Vendus settings |
| 403 Forbidden | Generic 403 + hint about register state, permissions | Check document series permissions |
| 404 No data | "No data" from client lookup | Gracefully creates new client |
| Network timeout | Job marked pending, retries automatically | Cron fallback handles retry |

### Observability

**Structured Logging:**
```json
{
  "event": "invoice:issued",
  "bookingId": 42,
  "provider": "vendus",
  "number": "FT T01P2025/1"
}

{
  "event": "invoice:skipped",
  "bookingId": 42,
  "reason": "INVOICING_ENABLED=false"
}

{
  "event": "job:failed",
  "jobId": 123,
  "bookingId": 42,
  "type": "issue_invoice",
  "error": "Vendus API error..."
}
```

**Files:**
- `lib/invoicing/issue-for-booking.ts` - Invoice issuance logging
- `lib/jobs/process-booking-jobs.ts` - Job processing logging
- `lib/invoicing/vendors/vendus/clients.ts` - Client resolution logging

---

## Failure Modes & Diagnostics

### Symptom: Invoice not issued

**Likely Causes:**
1. INVOICING_ENABLED !== "true" (feature flag)
2. Vendus API error (register closed, permissions)
3. Job queue stuck (job status=failed, attempts maxed)
4. Network connectivity to Vendus

**Where to Look:**
- Application logs: `invoice:issued`, `invoice:skipped`, `job:failed`
- Database: `BookingJob` table WHERE `type='issue_invoice'`
- Database: `Booking` table (check invoiceProviderId, invoiceNumber)

**Verification Steps:**
1. Check INVOICING_ENABLED: `echo $INVOICING_ENABLED`
2. Check job status: `SELECT * FROM "BookingJob" WHERE "bookingId" = <id> AND type = 'issue_invoice'`
3. Check booking: `SELECT "invoiceProviderId", "invoiceNumber" FROM "Booking" WHERE id = <id>`
4. Check logs for Vendus API errors

**Safe Mitigation:**
- Set INVOICING_ENABLED=true if disabled
- Open Vendus register if closed
- Manually retry job (update status to "pending", attempts to 0)
- Check Vendus API key permissions

### Symptom: Signed invoice link not working

**Likely Causes:**
1. Token expired (>72h old by default)
2. Secret mismatch (INVOICING_LINK_SECRET changed)
3. Booking ID mismatch in token vs URL
4. Token signature invalid

**Where to Look:**
- Browser error (403 Forbidden, 404 Not Found)
- Application logs: Token verification failures
- Database: Booking invoicePdfUrl (check if URL exists)

**Verification Steps:**
1. Decode token manually (base64url decode payload)
2. Check expiry: `payload.exp > now()`
3. Check INVOICING_LINK_SECRET hasn't changed
4. Verify bookingId matches: URL param === payload.bid

**Safe Mitigation:**
- Generate new token (if original expired)
- Ensure INVOICING_LINK_SECRET matches original secret
- Verify invoicePdfUrl is populated

---

## Source Pointers

**Vendus Integration:**
- `lib/invoicing/vendors/vendus/core.ts` - HTTP client, types, auth
- `lib/invoicing/vendors/vendus/documents.ts` - Document creation
- `lib/invoicing/vendors/vendus/clients.ts` - Client resolution
- `lib/invoicing/vendors/vendus/registers.ts` - Register validation
- `lib/invoicing/vendors/vendus/payload.ts` - Payload builders, VAT mapping
- `lib/invoicing/vendors/vendus/index.ts` - Provider implementation

**Invoice Orchestration:**
- `lib/invoicing/issue-for-booking.ts` - Invoice issuance orchestrator
- `lib/invoicing/provider.ts` - Provider interface (abstract)

**Signed Links:**
- `lib/security/signed-links.ts` - Token generation/verification
- `lib/invoicing/invoice-links.ts` - URL construction, base URL resolution

**PDF Proxy:**
- `app/api/invoices/[bookingId]/pdf/route.ts` - PDF proxy route

**Job Processing:**
- `lib/jobs/process-booking-jobs.ts` - Job processor
- `lib/jobs/booking-job-types.ts` - Job type definitions

---

## Open Questions / Risks

None identified. Invoicing system is stable and in production.

---

**See Also:**
- [Async Job Queue](async-jobs.md) - Job processing for invoice issuance
- [Notifications & Email](notifications-email.md) - Invoice ready email
- [Booking & Payments](booking-and-payments.md) - Payment flow before invoicing
