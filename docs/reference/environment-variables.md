# Environment Variables Reference

Alphabetical reference of all environment variables.

For grouped reference by subsystem, see [Environments & Secrets](../ops/environments-and-secrets.md).

---

## A

**ADMIN_TO**
- Type: Server
- Required: No
- Usage: Admin email recipient (preferred over EMAIL_ADMIN_TO)
- Source: `lib/emails/branding.ts`

**APP_URL**
- Type: Public
- Required: No (defaults to localhost:3000)
- Usage: Explicit base URL (highest priority)
- Source: `lib/url/base.ts`

**AUTH_COOKIE_SECRET**
- Type: Server
- Required: Yes (if auth enabled)
- Min Length: 32 chars
- Usage: HMAC secret for session cookies
- Source: `lib/auth/session.ts`

---

## C

**COMPANY_LEGAL_ADDRESS**
- Type: Server
- Required: Yes (production)
- Usage: Legal address for invoices
- Source: `lib/company/profile.ts`

**COMPANY_LEGAL_NAME**
- Type: Server
- Required: Yes (production)
- Usage: Legal entity name
- Source: `lib/company/profile.ts`

**COMPANY_NAME**
- Type: Server
- Required: Yes (production)
- Usage: Display company name
- Source: `lib/company/profile.ts`

**COMPANY_NIF**
- Type: Server
- Required: Yes (production)
- Usage: Portuguese tax ID
- Source: `lib/company/profile.ts`

**CONTEXT**
- Type: Server (Netlify)
- Auto-Set: Yes
- Values: production/branch-deploy/deploy-preview
- Source: Netlify environment

**CRON_SECRET**
- Type: Server
- Required: Yes (production)
- Usage: Cron endpoint authentication
- Source: `app/api/cron/*`

---

## D

**DATABASE_URL**
- Type: Server
- Required: Yes
- Usage: PostgreSQL connection (runtime, pooled)
- Source: `lib/db.ts`

**DEPLOY_PRIME_URL**
- Type: Server (Netlify)
- Auto-Set: Yes
- Usage: Deploy preview/branch URL
- Source: Netlify environment

**DEPLOY_URL**
- Type: Server (Netlify)
- Auto-Set: Yes
- Usage: Fallback deploy URL
- Source: Netlify environment

**DIRECT_URL**
- Type: Server
- Required: Yes (for migrations)
- Usage: Direct PostgreSQL for migrations
- Source: `prisma/schema.prisma`

---

## E

**E2E_SECRET**
- Type: Server
- Required: Yes (E2E tests)
- Usage: E2E test auth bypass
- Source: `middleware.ts`

**EMAIL_ADMIN_TO**
- Type: Server
- Required: No
- Usage: Admin email (ADMIN_TO preferred)
- Source: `lib/emails/branding.ts`

**EMAIL_FROM**
- Type: Server
- Required: Yes
- Usage: From email address
- Source: `lib/emails/mailer.ts`

**EMAIL_REPLY_TO**
- Type: Server
- Required: No
- Usage: Reply-to email
- Source: `lib/emails/mailer.ts`

**ENABLE_GEOFENCE**
- Type: Server
- Required: No (default: true)
- Usage: Feature flag for geofencing
- Source: `lib/geo/check-service-area.ts`

---

## I

**INVOICING_ENABLED**
- Type: Server
- Required: No (default: true)
- Usage: Feature flag for invoice issuance
- Source: `lib/invoicing/issue-for-booking.ts`

**INVOICING_LINK_SECRET**
- Type: Server
- Required: Yes
- Min Length: 24 chars
- Usage: JWT signing for invoice links
- Source: `lib/security/signed-links.ts`

**INVOICE_LINK_TTL_SECONDS**
- Type: Server
- Required: No (default: 259200 = 72h)
- Usage: Invoice link expiry time
- Source: `lib/invoicing/invoice-links.ts`

---

## M

**MAPBOX_ACCESS_TOKEN**
- Type: Server
- Required: Yes (if geofence enabled)
- Usage: Mapbox geocoding API
- Source: `lib/geo/mapbox.ts`

---

## N

**NEXT_PUBLIC_APP_URL**
- Type: Public
- Required: No
- Usage: Public base URL
- Source: `lib/url/base.ts`

**NEXT_PUBLIC_ENV**
- Type: Public
- Required: No
- Usage: Environment name (development/staging/production)
- Source: `lib/analytics.ts`

**NEXT_PUBLIC_FB_PIXEL_ID**
- Type: Public
- Required: No
- Usage: Meta Ads pixel ID
- Source: `app/layout.tsx`

**NEXT_PUBLIC_GA4_ID**
- Type: Public
- Required: No
- Usage: Google Analytics 4 property ID
- Source: `app/layout.tsx`

**NEXT_PUBLIC_GA_DEBUG**
- Type: Public
- Required: No
- Usage: Enable GA4 debug mode
- Source: `lib/analytics.ts`

**NEXT_PUBLIC_GADS_ID**
- Type: Public
- Required: No
- Usage: Google Ads conversion ID
- Source: `app/layout.tsx`

**NEXT_PUBLIC_SITE_URL**
- Type: Public
- Required: No (default: localhost:3000)
- Usage: Canonical URL for SEO
- Source: `app/sitemap.ts`

**NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY**
- Type: Public
- Required: Yes
- Usage: Stripe publishable key (browser)
- Source: `components/booking/*`

**NEXT_UNOPTIMIZED_IMAGES**
- Type: Server
- Required: No
- Usage: Disable Next.js image optimization
- Source: `next.config.mjs`

---

## O

**OPS_DASHBOARD_ENABLED**
- Type: Server
- Required: Yes (to enable ops routes)
- Values: "1" to enable
- Usage: Feature flag for ops dashboard
- Source: `middleware.ts`

**OPS_DISABLE_AUTH**
- Type: Server
- Required: No
- Values: "1" to disable
- Usage: Bypass auth (previews, local)
- Source: `middleware.ts`

**OPS_EXEC_HASH**
- Type: Server
- Required: No
- Usage: Bcrypt hash for exec role
- Source: `lib/auth/ops-password.ts`

**OPS_MANAGERS_HASH**
- Type: Server
- Required: No
- Usage: Bcrypt hash for managers role
- Source: `lib/auth/ops-password.ts`

**OPS_PASSCODE**
- Type: Server
- Required: Yes (if auth enabled)
- Usage: Plain password for ops login
- Source: `app/login/actions.ts`

---

## R

**RESEND_API_KEY**
- Type: Server
- Required: Yes
- Usage: Resend API authentication
- Source: `lib/emails/mailer.ts`

**RUN_MIGRATIONS**
- Type: Server
- Required: No
- Values: "1" to run
- Usage: Run Prisma migrations on build
- Source: `scripts/netlify-build.js`

---

## S

**SEND_EMAILS**
- Type: Server
- Required: No (default: false)
- Values: "true" to send
- Usage: Enable real email sending
- Source: `lib/emails/mailer.ts`

**STRIPE_CLI_WEBHOOK_SECRET**
- Type: Server
- Required: Dev only
- Usage: Stripe CLI webhook secret (local)
- Source: `tests/helpers/stripe-webhook.ts`

**STRIPE_SECRET_KEY**
- Type: Server
- Required: Yes
- Usage: Stripe API secret key
- Source: `lib/stripe.ts`

**STRIPE_TAX_RATE_PT_STANDARD**
- Type: Server
- Required: Yes
- Usage: PT VAT 23% tax rate ID
- Source: `lib/stripe/checkout.full.ts`

**STRIPE_WEBHOOK_SECRET**
- Type: Server
- Required: Yes
- Usage: Stripe webhook signature verification
- Source: `app/api/stripe/webhook/route.ts`

**SUPPORT_EMAIL**
- Type: Server
- Required: No
- Usage: Support contact email
- Source: `lib/company/profile.ts`

**SUPPORT_PHONE**
- Type: Server
- Required: No
- Usage: Support phone number
- Source: `lib/company/profile.ts`

---

## U

**URL**
- Type: Server (Netlify)
- Auto-Set: Yes
- Usage: Published/branch URL
- Source: Netlify environment

---

## V

**VENDUS_API_KEY**
- Type: Server
- Required: Yes
- Usage: Vendus API authentication
- Source: `lib/invoicing/vendors/vendus/core.ts`

**VENDUS_BASE_URL**
- Type: Server
- Required: No (default: https://www.vendus.pt/ws)
- Usage: Vendus API base URL
- Source: `lib/invoicing/vendors/vendus/core.ts`

**VENDUS_DOC_TYPE**
- Type: Server
- Required: No (default: FR)
- Values: FR/FT/PF/NC
- Usage: Invoice document type
- Source: `lib/invoicing/vendors/vendus/core.ts`

**VENDUS_MODE**
- Type: Server
- Required: No (default: tests)
- Values: tests/normal
- Usage: Vendus environment mode
- Source: `lib/invoicing/vendors/vendus/core.ts`

**VENDUS_REGISTER_ID**
- Type: Server
- Required: No (auto-discovered)
- Usage: Preferred register ID
- Source: `lib/invoicing/vendors/vendus/registers.ts`

---

## W

**WAREHOUSE_ADDRESS**
- Type: Server
- Required: No
- Usage: Pickup/return location
- Source: `lib/company/profile.ts`

**WAREHOUSE_HOURS**
- Type: Server
- Required: No (default: Mo-Fr 09:00-17:00)
- Usage: Operating hours
- Source: `lib/company/profile.ts`

---

**Last Updated:** 2025-12-29
