# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 14 machinery rental application deployed on Netlify. The app enables customers to book construction equipment online with full payment processing (Stripe), automated invoicing (Vendus API), and operational dashboards for staff.

**Tech Stack:**
- Next.js 14 (App Router) with TypeScript
- Prisma ORM with PostgreSQL
- Stripe for payments (card, MB WAY, SEPA)
- Vendus API for Portuguese invoicing
- Resend for transactional emails
- Radix UI + Tailwind CSS for components
- Vitest for unit tests, Playwright for E2E tests

## Common Development Commands

### Local Development
```bash
npm run dev              # Start Next.js dev server on localhost:3000
npm run dev:netlify      # Start Netlify dev server on port 8888
npm run dev:all          # Start Netlify dev (includes functions)
```

### Database
```bash
npx prisma generate      # Generate Prisma client
npx prisma migrate dev   # Run migrations (dev)
npm run db:seed          # Seed database with test data
npm run db:clean         # Clean database (blank state)
```

### Testing
```bash
npm test                 # Run Vitest in watch mode
npm run test:unit        # Run unit tests (alias for npm test)
npm run test:ci          # Run tests once (CI mode)
npm run test:integration # Run integration tests with testcontainers
npm run test:e2e         # Run Playwright E2E tests (chromium only)
npm run test:e2e:all     # Run E2E with HTML report
npm run test:e2e:all:clean # Clean DB then run E2E suite
```

**Important Testing Notes:**
- E2E tests require `.env.e2e.local` file configured
- Integration tests use testcontainers (PostgreSQL)
- E2E tests run against Netlify dev server (port 8888)
- Unit tests are in `/tests`, E2E tests are in `/e2e`

### Building
```bash
npm run build            # Production build with linting
npm run build:ci         # Production build without linting
npm run lint             # Run Next.js linter
```

## Architecture

### Directory Structure

```
/app                    # Next.js App Router pages and layouts
  /api                  # API routes (Next.js Route Handlers)
    /ops-admin          # Protected ops endpoints
    /dev                # Dev-only endpoints (gated in production)
    /stripe             # Stripe webhook handler
    /invoices           # Invoice proxy for signed links
  /ops-admin            # Internal dashboard pages (auth-gated)
  /booking              # Customer booking flow
  /machine              # Machine detail pages
  /login, /logout       # Auth pages

/lib                    # Core business logic (organized by domain)
  /auth                 # Session management, password hashing
  /booking              # Booking domain logic
  /company              # Company info utilities
  /content              # Content management
  /data                 # Data access utilities
  /emails               # Email templates (React Email)
  /invoicing            # Invoice issuance, signed links
  /notifications        # Email sending orchestration
  /ops                  # Ops dashboard utilities
  /repos                # Data repositories (booking-repo.ts)
  /security             # Security utilities
  /stripe               # Stripe integration (checkout, webhooks)
  /validation           # Zod schemas

/components             # React components (organized by feature)
  /booking              # Booking form components
  /auth                 # Auth UI components
  /analytics            # GA4 tracking components
  /forms                # Form components (shadcn/ui)

/prisma                 # Database schema and migrations
  /migrations           # Prisma migration files
  /data                 # CSV seed data
  schema.prisma         # Prisma schema

/tests                  # Unit and integration tests
  /unit                 # Unit tests
  /integration          # Integration tests (testcontainers)
  /helpers              # Test helpers
  /shims                # Test shims (e.g., server-only)

/e2e                    # Playwright E2E tests

/scripts                # Utility scripts
  /ops                  # Ops automation scripts
  netlify-build.js      # Netlify build script (runs migrations)
  seed-ops.ts           # Seed ops users

/netlify/functions      # Netlify serverless functions
```

### Key Architectural Patterns

#### Path Aliases
All imports use `@/` prefix for absolute paths:
```typescript
import { db } from "@/lib/db";
import BookingForm from "@/components/booking/booking-form";
```

#### Data Access Layer
- **Repository Pattern**: Business logic lives in `/lib/repos/booking-repo.ts`
- Booking state machine handles PENDING → CONFIRMED → CANCELLED transitions
- All database queries use Prisma Client (`db` from `@/lib/db`)

#### Payment Flow
1. Customer fills booking form → creates Stripe Checkout Session (full payment)
2. Redirect to Stripe hosted checkout
3. Stripe webhook (`/api/stripe/webhook`) confirms payment
4. Webhook handler:
   - Updates booking status to CONFIRMED
   - Issues invoice via Vendus API
   - Sends confirmation email
   - Sends internal notification

#### Invoicing Architecture
- **Provider**: Vendus API (Portuguese invoicing system)
- **Invoice proxy**: `/api/invoices/[token]` validates signed JWT tokens to serve PDFs
- Tokens are time-limited (72h production, configurable via `INVOICE_LINK_TTL_SECONDS`)
- Invoice metadata persisted in Booking model (provider, providerId, number, pdfUrl, atcud)

#### Authentication & Authorization
- **Ops Dashboard**: Protected by middleware (`middleware.ts`)
- Session-based auth using signed cookies (`AUTH_COOKIE_SECRET`)
- Three bypass modes (checked in order):
  1. E2E test header (`x-e2e-secret`)
  2. Feature flag check (`OPS_DASHBOARD_ENABLED`)
  3. Auth disabled flag (`OPS_DISABLE_AUTH`)
- Middleware redirects unauthenticated requests to `/login?next=...`

#### Environment-Specific Behavior
- **Production**: Runs migrations via `netlify-build.js`, ops auth required
- **Staging**: Runs migrations, ops auth required, uses test Stripe/Vendus keys
- **Deploy Previews**: No migrations, ops auth disabled (fast smoke testing)
- **Local Dev**: Uses `.env.local`, no migrations (manual `prisma migrate dev`)

### Critical Integration Points

#### Stripe Webhook Idempotency
- `StripeEvent` model ensures each webhook event processes exactly once
- Webhook handler checks `eventId` uniqueness before processing
- Handle both `payment_intent.succeeded` and async payment types (MB WAY, SEPA)

#### Holds & Expiry
- Bookings created in PENDING state with `holdExpiresAt` timestamp
- Unpaid bookings auto-expire (handled by availability logic, not cron)
- `/api/dev/holds/expire` endpoint for manual testing

#### Date Ranges & Availability
- Uses PostgreSQL `tsrange` type for date overlap detection
- `during` column auto-generated: `tsrange(startDate, endDate, '[]')`
- Availability checks use `@>` operator for range overlap
- All dates stored in UTC, displayed in Europe/Lisbon timezone

#### Geofencing
- Mapbox integration for delivery address validation
- `lib/geo` handles coordinate lookups and polygon containment
- Feature flagged via `ENABLE_GEOFENCE` env var
- Cached boundaries in `/lib/geo/boundaries/`

## Environment Variables

See `.env.example` for complete list. Critical variables:

**Required for local dev:**
- `DATABASE_URL` - PostgreSQL connection string
- `STRIPE_SECRET_KEY` - Stripe test secret key
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe test publishable key
- `STRIPE_WEBHOOK_SECRET` - For local webhook testing with Stripe CLI
- `APP_URL` - Base URL (usually `http://localhost:3000`)
- `INVOICING_LINK_SECRET` - Secret for signing invoice proxy links (min 24 chars)
- `AUTH_COOKIE_SECRET` - Secret for signing ops session cookies

**Ops dashboard:**
- `OPS_DASHBOARD_ENABLED=1` - Enable ops routes
- `OPS_DISABLE_AUTH=1` - Disable auth (local dev only)
- `OPS_PASSCODE` - Password for ops login (hashed with bcrypt)
- `OPS_EXEC_HASH` - Bcrypt hash for executive role
- `OPS_MANAGERS_HASH` - Bcrypt hash for manager role

**Testing:**
- `E2E_SECRET` - Bypass middleware in E2E tests
- `RUN_PAYMENT_E2E=1` - Enable payment flow E2E tests

## Testing Strategy

### Unit Tests (`/tests/unit`)
- Test pure functions, utilities, and business logic
- Use Vitest for test runner
- Mock Prisma client for data access tests
- Environment defaults injected by `vitest.config.ts`

### Integration Tests (`/tests/integration`)
- Use `@testcontainers/postgresql` for real database
- Test full API routes with actual Prisma queries
- Slower but higher confidence

### E2E Tests (`/e2e`)
- Playwright tests against full Netlify dev server
- Use `x-e2e-secret` header to bypass auth
- Clean database state with `npm run db:clean` before runs
- Test critical flows: booking, payment, invoice generation

## Database Schema Notes

### Machine Model
- `category` field mapped to DB column `type` (legacy compatibility)
- `imageUrl` deprecated (now using curated local assets)
- `referenceUrl` for ops reference only (not rendered)

### Booking Model
- `depositPaid` field repurposed to mean "fully paid" (rename in future)
- Refund tracking: `refundStatus`, `refundedAmountCents`, `refundIds`
- Dispute tracking: `disputeId`, `disputeStatus`, `disputeReason`
- Invoice fields: `invoiceProvider`, `invoiceProviderId`, `invoiceNumber`, `invoicePdfUrl`, `invoiceAtcud`
- Email timestamps: `confirmationEmailSentAt`, `invoiceEmailSentAt`, `internalEmailSentAt`

### Adding Migrations
```bash
# Make schema changes in prisma/schema.prisma
npx prisma migrate dev --name description_of_change
npx prisma generate
```

## Deployment (Netlify)

**Build Process:**
1. Netlify runs command from `netlify.toml` (`context.production.command`)
2. `scripts/netlify-build.js` runs migrations if `RUN_MIGRATIONS=1`
3. `next build` compiles the application
4. `@netlify/plugin-nextjs` packages for Netlify

**Branch Strategy:**
- `main` → Production (amr-rentals.com)
- `staging` → Staging environment (runs migrations)
- Feature branches → Deploy previews (no migrations)

**Middleware Canonicalization:**
- Production ops routes redirect non-canonical hosts to `amr-rentals.com`
- Prevents session issues across deploy-hash subdomains

## Common Pitfalls

1. **Forgot to run `npx prisma generate`** after schema changes → import errors
2. **E2E tests failing** → Check `.env.e2e.local` exists and `E2E_SECRET` matches
3. **Ops routes 404** → Set `OPS_DASHBOARD_ENABLED=1` in env
4. **Webhook not receiving events locally** → Start `stripe listen --forward-to localhost:3000/api/stripe/webhook`
5. **Availability logic broken** → Ensure `during` column populated (auto-generated on insert/update)
6. **Invoice links expired** → Check `INVOICING_LINK_SECRET` is set and tokens not stale (72h default)
7. **Import aliases broken** → Check `tsconfig.json` paths and `vitest.config.ts` aliases match

## Git Branches

- **Main branch**: `main` (production)
- **Current branch**: `staging` (usually for staging deploys)