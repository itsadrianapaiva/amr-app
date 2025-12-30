# Local Setup

Guide for setting up the AMR platform locally.

## Prerequisites

- **Node.js** 18+ (LTS recommended)
- **PostgreSQL** 14+ (local or managed)
- **Stripe CLI** (for webhook testing)
- **Git**

---

## Installation Steps

### 1. Clone Repository

```bash
git clone <repository-url>
cd amr-app
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Variables

Create `.env.local` (never commit this file):

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/amr_dev"
DIRECT_URL="postgresql://user:password@localhost:5432/amr_dev"

# Base URLs
APP_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Stripe (test keys)
STRIPE_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_CLI_WEBHOOK_SECRET="whsec_..."  # From stripe listen
STRIPE_TAX_RATE_PT_STANDARD="txr_..."  # Create in Dashboard

# Vendus (test mode)
VENDUS_API_KEY="your_test_key"
VENDUS_MODE="tests"
VENDUS_DOC_TYPE="FR"
INVOICING_ENABLED="true"
INVOICING_LINK_SECRET="test_secret_min_24_chars_required"

# Email (test mode or dry-run)
RESEND_API_KEY="re_..."
EMAIL_FROM="test@example.com"
SEND_EMAILS="false"  # Set to "true" to send real emails

# Ops Dashboard
OPS_DASHBOARD_ENABLED="1"
OPS_DISABLE_AUTH="1"  # Bypass auth for local dev
OPS_PASSCODE="test123"
AUTH_COOKIE_SECRET="local_dev_secret_min_32_chars_required"

# Testing
E2E_SECRET="local_e2e_secret"
CRON_SECRET="local_cron_secret"

# Optional
MAPBOX_ACCESS_TOKEN="pk...."  # For geofencing
ENABLE_GEOFENCE="true"
```

### 4. Database Setup

```bash
# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed database
npm run db:seed
```

### 5. Verify Setup

```bash
# Start dev server
npm run dev

# Open browser
open http://localhost:3000
```

---

## Testing Stripe Webhooks Locally

### Start Stripe CLI

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

**Copy webhook secret** from output and set as `STRIPE_CLI_WEBHOOK_SECRET`

### Trigger Test Event

```bash
stripe trigger payment_intent.succeeded
```

**Check logs** for webhook processing

---

## Running Tests

```bash
# Unit tests (watch mode)
npm test

# E2E tests
npm run test:e2e

# Clean database before E2E
npm run db:clean && npm run test:e2e
```

---

## Common Development Commands

### Database

```bash
# Prisma Studio (database GUI)
npx prisma studio

# Create new migration
npx prisma migrate dev --name <description>

# Reset database (destructive)
npx prisma migrate reset

# Seed data
npm run db:seed

# Clean all bookings
npm run db:clean
```

### Development Servers

```bash
# Next.js dev server (port 3000)
npm run dev

# Netlify dev server (port 8888, includes functions)
npm run dev:netlify

# Build for production
npm run build
```

### Linting

```bash
# Run Next.js linter
npm run lint
```

---

## Common Pitfalls

### 1. Forgot `npx prisma generate`

**Symptom:** Import errors for `@prisma/client`

**Fix:**
```bash
npx prisma generate
```

### 2. Ops routes return 404

**Symptom:** `/ops-admin` not found

**Fix:** Set `OPS_DASHBOARD_ENABLED=1` in `.env.local`

### 3. Webhook not receiving events

**Symptom:** Stripe CLI shows no forwards

**Fix:**
```bash
# Ensure Stripe CLI is running
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Update STRIPE_CLI_WEBHOOK_SECRET in .env.local
```

### 4. Import aliases broken

**Symptom:** Cannot find module `@/lib/...`

**Fix:** Check `tsconfig.json` paths match `vitest.config.ts` aliases

### 5. Geofencing errors

**Symptom:** Delivery address validation fails

**Fix:**
- Set `MAPBOX_ACCESS_TOKEN`
- Or disable: `ENABLE_GEOFENCE=false`

---

## Source Pointers

**Configuration:**
- `package.json` - Scripts
- `.env.example` - Environment variable template
- `tsconfig.json` - TypeScript configuration
- `next.config.mjs` - Next.js configuration

**Database:**
- `prisma/schema.prisma` - Data model
- `prisma/seed.ts` - Seed script
- `scripts/ops-behavior-smoke.ts` - Database cleanup

---

**See Also:**
- [CLAUDE.md](../../CLAUDE.md) - Comprehensive development guide
- [Adding Features](adding-features.md) - Development patterns

---

**Last Updated:** 2025-12-29
