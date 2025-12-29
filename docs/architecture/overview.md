# System Overview

This document provides a high-level architecture overview of the AMR Machinery Rental platform.

## System Purpose

The platform handles end-to-end machinery rental workflows:
- Customer browsing and date selection
- Stripe Checkout payment processing (card, MB WAY, SEPA)
- Automated Vendus invoice generation (Portuguese tax compliance)
- Transactional email notifications via Resend
- Operational dashboards for staff with session-based authentication

## Architecture Pattern

The system follows a domain-driven organization where business logic is grouped by responsibility rather than technical layer. The `/lib` directory contains core server-side modules, while `/app` contains Next.js routes (pages and API handlers).

## Module Boundaries

```
/app                    # Next.js App Router (pages + API routes)
├─ /api                 # API route handlers
│  ├─ /stripe           # Stripe webhook handler
│  ├─ /invoices         # Invoice PDF proxy (signed links)
│  ├─ /cron             # Background job processors
│  ├─ /dev              # Dev-gated test helpers
│  └─ /ops-admin        # Protected ops endpoints
├─ /booking             # Customer booking pages
├─ /machine             # Machine detail pages
├─ /ops-admin           # Ops dashboard pages
├─ /login, /logout      # Auth pages
└─ /legal               # Legal pages

/lib                    # Core business logic (domain modules)
├─ /repos               # Data access layer (booking-repo.ts)
├─ /stripe              # Stripe integration (checkout, webhooks)
├─ /invoicing           # Vendus integration, signed links
├─ /jobs                # Async job queue processing
├─ /notifications       # Email orchestration
├─ /emails              # React Email templates
├─ /auth                # Session management, password verification
├─ /ops                 # Ops dashboard utilities
├─ /geo                 # Mapbox geofencing
├─ /validation          # Zod schemas
└─ /security            # Signed links, secrets

/components             # React components (organized by feature)
/prisma                 # Database schema, migrations
/tests, /e2e            # Unit, integration, E2E tests
/scripts                # Utility scripts (build, seed, ops)
/netlify/functions      # Netlify serverless functions
```

## Request Flow Diagram

### Customer Booking Flow

```
Browser
   │
   ↓ GET /machine/[id]
[Machine Detail Page]
   │ (Server Component loads machine + disabled ranges)
   ↓
[BookingForm] (client component)
   │
   ↓ Form submission → createCheckoutAction() [Server Action]
   │
[app/actions/create-checkout.ts]
   ├─ Validate input (Zod schema)
   ├─ Check service area (geofence if delivery/pickup)
   ├─ Compute totals (VAT, discount, add-ons)
   ├─ createOrReusePendingBooking() → PENDING booking in DB
   ├─ buildFullCheckoutSessionParams()
   └─ createCheckoutSessionWithGuards() → Stripe API
   │
   ↓ Returns { ok: true, url: "https://checkout.stripe.com/..." }
   │
Browser redirects → Stripe Checkout
   │
   ↓ Customer pays (card, MB WAY, SEPA)
   │
Stripe → POST /api/stripe/webhook
   │
[app/api/stripe/webhook/route.ts]
   ├─ Verify signature (STRIPE_WEBHOOK_SECRET)
   ├─ Idempotency check (StripeEvent.eventId unique constraint)
   ├─ handleStripeEvent() → dispatch to event handler
   │  ↓
   │  [lib/stripe/handlers/checkout/completed.ts]
   │  ├─ promoteBookingToConfirmed() → PENDING → CONFIRMED
   │  ├─ createBookingJobs([issue_invoice, send_customer_confirmation, send_internal_confirmation])
   │  └─ Non-blocking kick to /api/cron/process-booking-jobs
   │
   └─ Return 200 ACK (always, even on handler errors)
   │
Stripe redirects browser → /booking/success?booking_id=123
   │
   ↓ Renders success page, fires GA4/Meta Pixel events
   │
[Background: Every 1 minute + immediate kick]
   │
[/api/cron/process-booking-jobs]
   ├─ Fetch pending jobs (ordered by createdAt)
   ├─ Atomic claim: update status to "processing"
   ├─ Execute job:
   │  ├─ issue_invoice → Vendus API → persist metadata
   │  ├─ send_customer_confirmation → Resend email
   │  └─ send_internal_confirmation → Resend email to ops
   ├─ Mark completed or retry on failure (max 3 attempts)
   └─ Return metrics JSON
```

## Data Flow

### Payment Confirmation → Invoice → Email

```
Stripe Webhook Event (payment_intent.succeeded)
   │
   ↓
StripeEvent Table (idempotency guard)
   │
   ↓ First time seeing this event.id
   │
promoteBookingToConfirmed()
   ├─ Booking: PENDING → CONFIRMED
   ├─ Set depositPaid = true
   ├─ Attach stripePaymentIntentId
   ├─ Clear holdExpiresAt
   └─ Persist discount metadata
   │
   ↓
createBookingJobs()
   ├─ BookingJob: { type: "issue_invoice", status: "pending" }
   ├─ BookingJob: { type: "send_customer_confirmation", status: "pending" }
   └─ BookingJob: { type: "send_internal_confirmation", status: "pending" }
   │
   ↓ (Cron every 1 min + immediate kick)
   │
processBookingJobs() [Atomic claim]
   │
   ├─ Job 1: issue_invoice
   │  │
   │  ↓ maybeIssueInvoice()
   │  │
   │  Vendus API (POST /v1.1/documents/)
   │  ├─ Resolve client by NIF or email
   │  ├─ Build document payload (FR/FT, VAT 23%, items)
   │  └─ Receive { id, number, pdf_url, atcud }
   │  │
   │  ↓ Persist to Booking
   │  │
   │  Booking: invoiceProvider="vendus", invoiceProviderId, invoiceNumber, invoicePdfUrl, invoiceAtcud
   │  │
   │  ↓ Create follow-up job
   │  │
   │  BookingJob: { type: "send_invoice_ready", status: "pending" }
   │
   ├─ Job 2: send_customer_confirmation
   │  │
   │  ↓ notifyBookingConfirmed(bookingId, "customer")
   │  │
   │  ├─ Check confirmationEmailSentAt === null (idempotency)
   │  ├─ Build email (React Email template)
   │  ├─ Send via Resend
   │  └─ Set confirmationEmailSentAt = now()
   │
   ├─ Job 3: send_internal_confirmation
   │  │
   │  ↓ notifyBookingConfirmed(bookingId, "ops")
   │  │
   │  ├─ Check internalEmailSentAt === null
   │  ├─ Build internal email
   │  ├─ Send to EMAIL_ADMIN_TO
   │  └─ Set internalEmailSentAt = now()
   │
   └─ Job 4: send_invoice_ready (created by job 1)
      │
      ↓ notifyInvoiceReady(bookingId)
      │
      ├─ Check invoiceEmailSentAt === null
      ├─ Generate signed JWT token (72h TTL)
      ├─ Build email with /api/invoices/[id]/pdf?t=<token> link
      ├─ Send via Resend
      └─ Set invoiceEmailSentAt = now()
```

## Integration Points

### Stripe
- **Purpose:** Payment processing (card, MB WAY, SEPA)
- **Endpoints:** Checkout API, Webhooks API
- **Key Files:**
  - `lib/stripe/checkout.full.ts` - Session builder
  - `lib/stripe/create-session.ts` - Session creation wrapper
  - `app/api/stripe/webhook/route.ts` - Webhook handler
  - `lib/stripe/handlers/*` - Event-specific handlers
- **Security:** Signature verification, idempotency via StripeEvent table

### Vendus
- **Purpose:** Portuguese tax-compliant invoicing
- **Endpoints:** v1.1 Documents API, Clients API, Registers API
- **Key Files:**
  - `lib/invoicing/vendors/vendus/core.ts` - HTTP client
  - `lib/invoicing/vendors/vendus/documents.ts` - Document creation
  - `lib/invoicing/vendors/vendus/clients.ts` - Client resolution
  - `app/api/invoices/[bookingId]/pdf/route.ts` - PDF proxy
- **Security:** HTTP Basic auth, signed JWT links for PDF access

### Resend
- **Purpose:** Transactional email delivery
- **Endpoints:** Email API
- **Key Files:**
  - `lib/emails/mailer.ts` - Resend client wrapper
  - `lib/emails/templates/*` - React Email templates
  - `lib/notifications/*` - Email orchestration
- **Features:** Dry-run mode, HTML-to-text fallback

### Mapbox
- **Purpose:** Geofencing (delivery address validation)
- **Endpoints:** Places API (geocoding)
- **Key Files:**
  - `lib/geo/mapbox.ts` - Geocoding client
  - `lib/geo/check-service-area.ts` - Service area validation
- **Feature Flag:** `ENABLE_GEOFENCE`

## Reliability Patterns

### Idempotency
- **Webhook events:** StripeEvent table with unique constraint on eventId
- **Booking creation:** Reuse existing PENDING booking for same customer + dates
- **Email sending:** Atomic timestamp updates (confirmationEmailSentAt null check)
- **Job processing:** Atomic claim via updateMany with status predicate
- **Checkout sessions:** Idempotency keys based on booking + selections hash

### Retry & Resilience
- **Job queue:** Automatic retry up to 3 attempts with failure tracking
- **Webhook ACK:** Always return 200 to prevent retry storms
- **Email failures:** Non-fatal, don't block critical paths
- **Invoice failures:** Persisted in job result for manual investigation

### Transaction Boundaries
- **Booking creation:** Advisory locks per machineId serialize concurrent writes
- **Payment confirmation:** Transaction wraps booking update + job creation
- **Timeouts:** 12s transaction runtime, 5s queue wait

### Environment Separation
- **Production:** Runs migrations, full auth, live keys (VENDUS_MODE=normal, sk_live_*)
- **Staging:** Runs migrations, full auth, test keys (VENDUS_MODE=tests, sk_test_*)
- **Deploy Previews:** No migrations, auth bypass, test keys (fast smoke testing)
- **Local:** Manual migrations, auth bypass, test keys

## Source Pointers

**Core Application Files:**
- `app/layout.tsx` - Root layout, analytics setup
- `app/page.tsx` - Homepage with machine showcase
- `app/machine/[id]/page.tsx` - Machine detail with booking form
- `app/booking/success/page.tsx` - Payment success page
- `middleware.ts` - Auth guards for /ops-admin, /dev, /api/dev

**Business Logic:**
- `lib/repos/booking-repo.ts` - Booking creation, state transitions
- `lib/stripe/webhook-service.ts` - Payment confirmation logic
- `lib/invoicing/issue-for-booking.ts` - Invoice orchestration
- `lib/jobs/process-booking-jobs.ts` - Job queue processor

**Database:**
- `prisma/schema.prisma` - Data model
- `lib/db.ts` - Prisma client singleton

**Configuration:**
- `netlify.toml` - Build contexts, env vars
- `next.config.mjs` - Next.js configuration
- `playwright.config.ts` - E2E test configuration
- `vitest.config.ts` - Unit test configuration

## Open Questions / Risks

None identified. System is in production with stable behavior.

---

**See Also:**
- [Data Model](data-model.md) - Detailed schema documentation
- [Booking & Payments](booking-and-payments.md) - Payment flow details
- [Async Job Queue](async-jobs.md) - Job processing architecture
