# Algarve Machinery Rentals - Backend System

A production machinery rental platform handling online bookings, payment processing, automated invoicing, and operational management. This system processes real customer transactions with full payment lifecycle support, multi-provider integrations, and operational dashboards for staff.

The backend is built on Next.js 14 (App Router) with TypeScript, serving a REST-like API consumed by a server-rendered frontend. The architecture emphasizes transactional correctness, payment reliability, and auditability for regulated invoicing requirements in the Portuguese market.

## Backend Architecture

The system follows a domain-driven organization pattern where business logic is grouped by domain responsibility rather than technical layer. The `/lib` directory contains core server-side logic organized into modules (booking, stripe, invoicing, auth, notifications), each encapsulating a specific area of business concern.

Data access uses the repository pattern to isolate persistence logic from business rules. The booking repository ([lib/repos/booking-repo.ts](lib/repos/booking-repo.ts)) implements complex workflows like availability checking, hold management, and concurrency control using PostgreSQL advisory locks and transaction boundaries.

API routes in `/app/api` serve as thin handlers that validate input, delegate to service modules, and format responses. Critical paths (payment webhooks, invoice generation) use structured logging for observability and implement graceful degradation when external services fail.

The architecture separates public customer-facing APIs, authenticated webhook endpoints with signature verification, time-limited signed links for invoice delivery, and role-based protected routes for operational dashboards.

## Core Backend Features

- **Booking state machine**: PENDING � CONFIRMED � CANCELLED transitions with hold expiration (30-minute rolling windows), overlap detection via PostgreSQL tsrange exclusion constraints, and optimistic concurrency control
- **Full payment lifecycle**: Stripe integration handling checkout sessions, card/MB WAY/SEPA payment methods, webhook event processing with exactly-once semantics via idempotency tracking, refund state synchronization, and dispute logging
- **Automated invoicing**: Integration with Vendus API for Portuguese tax-compliant invoice generation, metadata persistence for offline serving, and time-limited signed PDF links (72-hour TTL)
- **Transactional email orchestration**: Confirmation emails, invoice delivery, and internal notifications with non-fatal failure handling to prevent blocking critical paths
- **Multi-tenant discounting**: Company discount lookup by Portuguese NIF (tax ID) with percentage-based pricing adjustments applied at checkout
- **Geographic service validation**: Mapbox-based geofencing for delivery address verification within operational boundaries
- **Session-based ops authentication**: HMAC-signed cookies with role-based access (exec, managers) protecting internal dashboards and administrative endpoints
- **Environment separation**: Distinct behavior for production (migrations, full auth), staging (migrations, test keys), and deploy previews (no migrations, auth bypass for smoke testing)

## Data Model and Persistence

The persistence layer uses Prisma ORM with PostgreSQL, modeling three core domains: machinery inventory, customer bookings, and payment/invoice records.

The **Machine** model represents rental inventory with daily rates, deposit requirements, optional delivery/pickup charges, and operator availability. Each machine has a minimum rental period (minDays) with special lead-time enforcement for heavy equipment requiring advance booking.

The **Booking** model is the central entity, capturing customer identity (name, email, phone, tax ID), rental dates with PostgreSQL tsrange for overlap detection, billing information for invoicing, operational site address for delivery, payment status, and invoice metadata. The booking includes detailed add-on selections (insurance, delivery, pickup, operator), discount tracking, refund state (status, amounts, transaction IDs), and dispute tracking (ID, status, reason, timestamps). Email delivery is tracked via timestamps (confirmation, invoice, internal notification) to prevent duplicate sends.

The **StripeEvent** model implements webhook idempotency by storing unique event IDs with a database-level uniqueness constraint, ensuring each payment event processes exactly once even under retry storms.

The **BookingJob** model implements a durable async job queue for booking-related side effects (invoice issuance, email notifications). Jobs are claimed atomically by the processor using updateMany semantics, track retry attempts with configurable max attempts, and store execution results as JSON. A unique constraint on (bookingId, type) ensures exactly-once job creation per booking action, providing idempotency at the queue level.

The **CompanyDiscount** model stores percentage-based discounts keyed by Portuguese NIF for B2B customer pricing.

Date handling deserves special attention: all dates are stored in UTC but normalized to Lisbon calendar days to handle DST transitions correctly. The booking's `during` column is a generated PostgreSQL tsrange that enables efficient overlap queries using the `@>` containment operator.

## Business Logic and Workflows

The booking creation workflow begins with form submission, which is validated using Zod schemas that enforce machine-specific constraints (minimum days, lead time requirements). The `createOrReusePendingBooking` function implements idempotent booking creation: if the same customer submits the same dates for the same machine within 30 minutes, the existing PENDING booking is reused and its hold extended. This prevents duplicate inventory locks during multi-step checkouts.

Availability checking wraps database queries in advisory locks to serialize concurrent writes per machine. The function queries for confirmed bookings, merges overlapping ranges, and checks the requested period against the unavailable set. Lead-time enforcement is implemented here: certain machines (IDs 5, 6, 7) require two full calendar days of advance notice.

The payment workflow uses Stripe Checkout Sessions with full upfront payment. When the customer completes payment, Stripe fires a webhook to `/api/stripe/webhook`. The handler verifies the signature, extracts the event, and dispatches to type-specific handlers in the registry pattern. The `checkout.session.completed` handler checks payment status and either promotes immediately (card payments) or defers to `async_payment_succeeded` for MB WAY and SEPA.

Promotion from PENDING to CONFIRMED is atomic: update booking status, attach payment intent ID, clear hold expiration, and create async jobs for invoice issuance and notifications. The webhook returns 200 immediately (typically <1 second), and a scheduled job processor executes the side effects within seconds. This async pattern keeps webhooks fast, makes side effects retryable with automatic failure tracking, and prevents external service timeouts from blocking payment confirmation. The webhook handler fires a non-blocking immediate kick to the job processor for sub-5-second end-to-end latency in typical cases.

The invoicing workflow transforms booking data into Vendus API format, issues the document, and persists metadata (provider ID, document number, PDF URL, ATCUD validation code) to the booking record. Invoice PDFs are served via a proxy endpoint (`/api/invoices/[id]/pdf`) that validates time-limited JWT tokens in query parameters, preventing unauthorized access while allowing email links to remain functional for 72 hours.

Refund handling is reactive: when Stripe fires `charge.refunded` events, the handler calculates total refunded amounts across all refund transactions, updates the booking's `refundStatus` (NONE, PARTIAL, FULL), and appends new refund IDs to the tracking array. This provides a full audit trail without requiring a separate refunds table.

Job processing runs via a scheduled Netlify function (`netlify/functions/process-booking-jobs.ts`) every minute, plus an immediate non-blocking kick after each webhook event. The processor fetches pending jobs ordered by creation time, claims them atomically using updateMany with a status predicate, executes the job logic (invoice issuance via Vendus API, email sending via Resend), and updates the job record with completion status or error details. Failed jobs retry up to 3 times with exponential backoff before marking as permanently failed for manual investigation. The processor exposes metrics (processed count, remaining pending) via structured JSON logs for operational monitoring.

## API Design

API routes follow Next.js Route Handler conventions with explicit runtime and caching directives. Public customer APIs use `dynamic = "force-dynamic"` and `revalidate = 0` to prevent stale data. Authenticated endpoints check middleware-injected session claims or verify signed tokens.

The `/api/stripe/webhook` endpoint is structured for reliability: signature verification happens first (fails with 400), event handling happens second (logs errors, returns 200), and the response is always 200 to acknowledge receipt. This prevents Stripe from retrying transient handler bugs.

The `/api/invoices/[bookingId]/pdf` endpoint validates signed tokens with constant-time comparison, checks expiration, queries the booking to verify ownership, and streams the PDF from the invoice provider's URL. This proxy pattern keeps provider URLs internal while enabling public access through controlled links.

The `/api/ops-admin/*` routes are protected by middleware that checks session cookies. If the session is invalid or missing, API requests receive 401 JSON responses while page requests redirect to `/login?next=...` for post-authentication continuation.

Request validation uses Zod schemas with conditional refinements. For example, billing address fields are required only when `billingIsBusiness` is true. Runtime schemas are constructed dynamically to inject machine-specific constraints like minimum days and lead time.

Error responses follow HTTP semantics: 400 for validation failures, 401 for missing auth, 403 for insufficient permissions, 404 for missing resources, 500 for unexpected errors. Error messages include context (earliest allowed booking date, conflicting date ranges) to enable client-side remediation.

## Reliability and Production Concerns

Webhook idempotency is enforced at the database level: each Stripe event ID is inserted into the StripeEvent table with a unique constraint. If the insert fails with a uniqueness violation (Prisma error code P2002), the handler treats this as a duplicate and skips processing. This guarantees exactly-once semantics even under webhook retries.

Transactional boundaries use explicit timeouts (12 seconds for transaction runtime, 5 seconds for queue wait) to prevent indefinite blocking under load. Advisory locks serialize concurrent bookings per machine while allowing parallel bookings across different machines.

Environment-specific behavior is controlled via feature flags and Netlify context variables. Production runs full migrations via [scripts/netlify-build.js](scripts/netlify-build.js), enforces ops authentication, and uses production Stripe/Vendus keys. Deploy previews skip migrations for fast feedback, disable authentication for automated testing, and use test keys. This separation enables rapid iteration without production risk.

Configuration management uses environment variables with validation at startup. Critical secrets (database URL, Stripe secret, webhook secret, invoice signing secret, auth cookie secret) are required. Optional feature flags (INVOICING_ENABLED, SEND_EMAILS, ENABLE_GEOFENCE) gate functionality. The `/api/env-check` endpoint surfaces configuration errors before runtime failures.

Structured logging emits events at key lifecycle points: `create:start`, `create:done`, `promote:start`, `invoice:issued`, `notify:error`. Each log entry includes relevant context (booking ID, machine ID, customer email, error messages). This enables post-hoc debugging and operational monitoring.

Error handling distinguishes between retryable and terminal failures. Database constraint violations (overlapping bookings, duplicate event IDs) are caught and translated to typed errors (OverlapError, LeadTimeError) that callers can handle explicitly. External service failures (invoice API, email delivery) are logged but do not propagate, ensuring critical paths complete even when optional features fail.

## Frontend

The frontend is a server-rendered Next.js application that consumes the backend APIs. Components handle form state and display logic, while all business rules and data persistence happen server-side. Pages use React Server Components for initial data loading with Next.js Route Handlers for mutations.

## Tech Stack

**Backend:**
- Next.js 14 (App Router) with TypeScript
- Prisma ORM with PostgreSQL
- Stripe API for payment processing
- Vendus API for Portuguese invoicing
- Resend for transactional email delivery
- Netlify Functions for serverless deployment

**Frontend:**
- React Server Components and Client Components
- Radix UI primitives for accessible components
- Tailwind CSS for styling
- Mapbox for address validation

**Testing:**
- Vitest for unit tests
- Testcontainers for integration tests
- Playwright for end-to-end tests

**Deployment:**
- Netlify with environment-specific build contexts
- PostgreSQL managed database
- Stripe webhooks for payment events
- Automated migrations in production/staging
- Scheduled job processing for async side effects (invoice, email)
