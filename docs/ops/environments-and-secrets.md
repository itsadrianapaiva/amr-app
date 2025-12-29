# Environments & Secrets

Complete environment variable reference for the AMR platform.

## Environment Contexts

| Context | RUN_MIGRATIONS | Auth | Keys | Use Case |
|---------|----------------|------|------|----------|
| **Production** (main) | 1 | Required | Live | amr-rentals.com |
| **Staging** (staging) | 1 | Required | Test | Staging environment |
| **Deploy Preview** (PRs) | 0 | Bypass | Test | Fast smoke testing |
| **Local** (.env.local) | Manual | Bypass | Test | Development |

---

## Critical Configuration Checklist

### Production
- DATABASE_URL + DIRECT_URL (managed PostgreSQL)
- STRIPE_SECRET_KEY=sk_live_* (live keys)
- STRIPE_TAX_RATE_PT_STANDARD (production tax rate ID)
- VENDUS_MODE=normal (live invoicing)
- VENDUS_API_KEY (production key)
- INVOICING_ENABLED=true
- SEND_EMAILS=true
- AUTH_COOKIE_SECRET (min 32 chars)
- INVOICING_LINK_SECRET (min 24 chars)
- OPS_DASHBOARD_ENABLED=1

### Staging
- STRIPE_SECRET_KEY=sk_test_* (test keys)
- VENDUS_MODE=tests (sandbox)
- All other secrets configured

### Local Development
- OPS_DISABLE_AUTH=1 (bypass for dev)
- LOG_CHECKOUT_DEBUG=1 (optional)
- Use .env.local (never commit)

---

## Environment Variables by Subsystem

### Database (2 vars)

| Variable | Required | Example |
|----------|----------|---------|
| `DATABASE_URL` | Yes | `postgres://user:pass@host:5432/db` |
| `DIRECT_URL` | Yes (migrations) | Same without connection pooling |

**Source**: `lib/db.ts`

### URLs & Domain (6 vars)

| Variable | Type | Usage |
|----------|------|-------|
| `APP_URL` | Manual | Explicit base URL (preferred) |
| `NEXT_PUBLIC_APP_URL` | Public | Public base (browser-safe) |
| `URL` | Netlify | Published/branch URL |
| `DEPLOY_PRIME_URL` | Netlify | Deploy preview URL |
| `DEPLOY_URL` | Netlify | Fallback deploy URL |
| `CONTEXT` | Netlify | production/branch-deploy/deploy-preview |

**Resolution Order**: APP_URL → NEXT_PUBLIC_APP_URL → URL → DEPLOY_PRIME_URL → localhost:3000

**Source**: `lib/url/base.ts`

### Stripe (5 vars)

| Variable | Required | Example |
|----------|----------|---------|
| `STRIPE_SECRET_KEY` | Yes | sk_test_* or sk_live_* |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Yes | pk_test_* or pk_live_* |
| `STRIPE_WEBHOOK_SECRET` | Yes | whsec_* (Dashboard) |
| `STRIPE_CLI_WEBHOOK_SECRET` | Dev only | whsec_* (stripe listen) |
| `STRIPE_TAX_RATE_PT_STANDARD` | Yes | txr_* (23% VAT rate ID) |

**Source**: `lib/stripe.ts`, `lib/stripe/checkout.full.ts`

### Vendus Invoicing (8 vars)

| Variable | Required | Default |
|----------|----------|---------|
| `VENDUS_API_KEY` | Yes | - |
| `VENDUS_BASE_URL` | No | https://www.vendus.pt/ws |
| `VENDUS_MODE` | No | tests |
| `VENDUS_DOC_TYPE` | No | FR |
| `VENDUS_REGISTER_ID` | No | Auto-discovered |
| `INVOICING_ENABLED` | No | true |
| `INVOICING_LINK_SECRET` | Yes | Min 24 chars |
| `INVOICE_LINK_TTL_SECONDS` | No | 259200 (72h) |

**Source**: `lib/invoicing/vendors/vendus/core.ts`

### Email (6 vars)

| Variable | Required | Example |
|----------|----------|---------|
| `RESEND_API_KEY` | Yes | re_* |
| `EMAIL_FROM` | Yes | noreply@amr-rentals.com |
| `EMAIL_REPLY_TO` | No | support@amr-rentals.com |
| `SEND_EMAILS` | No | true |
| `EMAIL_ADMIN_TO` | No | ops@amr-rentals.com |
| `ADMIN_TO` | No | Preferred over EMAIL_ADMIN_TO |

**Source**: `lib/emails/mailer.ts`

### Ops Authentication (8 vars)

| Variable | Required | Purpose |
|----------|----------|---------|
| `OPS_DASHBOARD_ENABLED` | Yes | Enable ops routes (1) |
| `OPS_DISABLE_AUTH` | No | Bypass auth (previews, local) |
| `AUTH_COOKIE_SECRET` | Yes (if auth) | Min 32 chars |
| `OPS_PASSCODE` | Yes (if auth) | Plain password |
| `OPS_EXEC_HASH` | No | Bcrypt hash (exec role) |
| `OPS_MANAGERS_HASH` | No | Bcrypt hash (managers role) |
| `OPS_SESSION_TTL_SECONDS` | No | 604800 (7 days) |
| `OPS_KEY` | Reserved | Future use |

**Source**: `middleware.ts`, `lib/auth/session.ts`

### Testing & Security (4 vars)

| Variable | Purpose |
|----------|---------|
| `E2E_SECRET` | E2E test auth bypass header |
| `CRON_SECRET` | Cron endpoint auth |
| `RUN_PAYMENT_E2E` | Enable payment E2E tests |
| `SEED_RESET` | Database seeding toggle |

**Source**: `middleware.ts`, `app/api/cron/*`

### Analytics (6 vars - all public)

| Variable | Optional | Example |
|----------|----------|---------|
| `NEXT_PUBLIC_GA4_ID` | Yes | G-* |
| `NEXT_PUBLIC_GADS_ID` | Yes | AW-* |
| `NEXT_PUBLIC_FB_PIXEL_ID` | Yes | * |
| `NEXT_PUBLIC_GA_DEBUG` | Yes | 1 |
| `NEXT_PUBLIC_SITE_URL` | Yes | https://amr-rentals.com |
| `NEXT_PUBLIC_ENV` | Yes | production/staging |

**Source**: `app/layout.tsx`, `lib/analytics.ts`

### Maps (2 vars)

| Variable | Required | Purpose |
|----------|----------|---------|
| `ENABLE_GEOFENCE` | No (default true) | Feature flag |
| `MAPBOX_ACCESS_TOKEN` | Yes (if enabled) | Geocoding API |

**Source**: `lib/geo/mapbox.ts`

### Company Info (8 vars - server-only)

| Variable | Required | Fallback |
|----------|----------|----------|
| `COMPANY_NAME` | Prod | Algarve Machinery Rental |
| `COMPANY_LEGAL_NAME` | Prod | Full legal name |
| `COMPANY_NIF` | Prod | 000000000 |
| `COMPANY_LEGAL_ADDRESS` | Prod | Legal address |
| `SUPPORT_EMAIL` | No | - |
| `SUPPORT_PHONE` | No | - |
| `WAREHOUSE_ADDRESS` | No | - |
| `WAREHOUSE_HOURS` | No | Mo-Fr 09:00-17:00 |

**Source**: `lib/company/profile.ts`

---

## Validation Patterns

### Throw if Missing (Fatal)
```typescript
const key = process.env.VENDUS_API_KEY;
if (!key) throw new Error("Missing VENDUS_API_KEY");
```

### Feature Gate (Graceful)
```typescript
if (process.env.INVOICING_ENABLED !== "true") return null;
```

### Environment-Specific Validation
```typescript
if (NODE_ENV === "production" && !COMPANY_NIF) {
  throw new Error("COMPANY_NIF required in production");
}
```

---

## Source Pointers

Complete mapping of where each variable is read available in exploration findings. Key files:
- `lib/db.ts` - Database
- `lib/stripe.ts` - Stripe client
- `lib/invoicing/vendors/vendus/core.ts` - Vendus
- `lib/emails/mailer.ts` - Email
- `middleware.ts` - Auth/security
- `lib/url/base.ts` - URL resolution

---

**Last Updated:** 2025-12-29
