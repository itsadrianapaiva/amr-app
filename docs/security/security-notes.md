# Security Notes

Security architecture and threat model documentation.

## Trust Boundaries

```
Internet (Untrusted)
   ↓
Public Routes (/machine, /booking)
   ↓
[Stripe Checkout] → Customer payment (external, trusted)
   ↓
Webhook (/api/stripe/webhook)
   ├─ Signature Verification (STRIPE_WEBHOOK_SECRET)
   └─ [Trusted after verification]
   ↓
Internal Services (Vendus, Resend)
   ├─ HTTP Basic Auth (Vendus)
   └─ API Key Auth (Resend)
   ↓
Ops Dashboard (/ops-admin)
   ├─ Session Cookie (signed with AUTH_COOKIE_SECRET)
   └─ [Trusted after auth]
```

---

## Authentication & Authorization

### Session Cookie Security

**Implementation:** `lib/auth/session.ts`

**Cookie:** `amr_ops`
**Format:** `base64url(JSON).base64url(HMAC-SHA256)`
**Claims:** `{ sub, role, iat, exp }`
**TTL:** 7 days (configurable)
**Flags:**
- `HttpOnly: true` (no JS access)
- `Secure: true` (production only)
- `SameSite: Lax`

**Secret:** `AUTH_COOKIE_SECRET` (min 32 chars)

### Auth Bypass Hierarchy

**File:** `middleware.ts`

**Order of evaluation:**
1. **E2E Header** (highest priority): `x-e2e-secret === E2E_SECRET` → Allow
2. **Feature Flag**: `OPS_DASHBOARD_ENABLED !== "1"` → 404
3. **Auth Disabled**: `OPS_DISABLE_AUTH === "1"` → Allow (previews/local)
4. **Session Verification**: Verify cookie → Redirect to `/login` or 401

### Password Handling

**Login:** `app/login/actions.ts`

**Storage:** Plain `OPS_PASSCODE` env var (compared during login)
**Role Hashes:** Bcrypt hashes for exec/managers roles
**No Hashing:** Password compared plain (secure via HTTPS)

**Future Improvement:** Hash passwords before storage

---

## Webhook Signature Verification

**File:** `app/api/stripe/webhook/route.ts`

**Process:**
```typescript
const sig = req.headers.get("stripe-signature");
const event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
```

**Protection:**
- Prevents unauthorized webhook injection
- Uses HMAC-SHA256 signature
- Timestamp prevents replay attacks
- Returns 400 on verification failure (Stripe retries)

**Critical:** Always verify signature before processing

---

## Signed Invoice Links (JWT-style)

**File:** `lib/security/signed-links.ts`

**Token Format:** `v1.{base64url(payload)}.{hex(hmac-sha256)}`

**Security Features:**
- Time-limited (72h default)
- HMAC-SHA256 with secret (INVOICING_LINK_SECRET)
- Constant-time signature comparison (`timingSafeEqual`)
- Payload includes booking ID (prevents tampering)

**Secret:** Minimum 24 characters (enforced at runtime)

**Validation:** `app/api/invoices/[bookingId]/pdf/route.ts`
- Verify signature
- Check expiry
- Check booking ID matches

---

## Dev Route Gating

**File:** `middleware.ts`

**Routes Protected:**
- `/dev/*`
- `/api/dev/*`

**Protection:**
- Production-like hosts: Require `x-e2e-secret` header → 404 if missing
- Non-production hosts: Allow unrestricted access

**Purpose:** Prevent exposure of test helpers in production

---

## Secrets Hygiene

### Minimum Lengths

| Secret | Minimum | Purpose |
|--------|---------|---------|
| `AUTH_COOKIE_SECRET` | 32 chars | Session signing |
| `INVOICING_LINK_SECRET` | 24 chars | Invoice link signing |
| `CRON_SECRET` | 16 chars+ | Cron auth (recommended) |

### Rotation

**When to Rotate:**
- Suspected compromise
- Employee offboarding
- Regular intervals (90 days recommended)

**How to Rotate:**
1. Generate new secret
2. Update Netlify env var
3. Trigger new deploy
4. Old sessions/links become invalid (acceptable)

---

## OWASP Top 10 Considerations

### Injection
- **SQL Injection**: Protected by Prisma ORM (parameterized queries)
- **Command Injection**: No shell commands with user input

### Broken Authentication
- Session cookies with HMAC signature
- Constant-time comparison for signatures
- HttpOnly + Secure flags

### Sensitive Data Exposure
- HTTPS enforced in production
- Secrets in environment variables (not code)
- No sensitive data in logs

### XML External Entities (XXE)
- Not applicable (no XML parsing)

### Broken Access Control
- Middleware enforces auth on `/ops-admin/*`
- Webhook signature verification
- Signed invoice links prevent unauthorized access

### Security Misconfiguration
- Environment-specific configs (prod vs staging)
- Feature flags for sensitive features
- Dev routes gated in production

### Cross-Site Scripting (XSS)
- React auto-escapes by default
- No `dangerouslySetInnerHTML` usage
- Content-Security-Policy headers (future enhancement)

### Insecure Deserialization
- JSON parsing only (safe types)
- Zod validation on all inputs

### Using Components with Known Vulnerabilities
- `npm audit` in CI
- Dependabot alerts enabled

### Insufficient Logging & Monitoring
- Structured logging for critical paths
- Stripe webhook events logged
- Job processing logged
- Future: Centralized logging (Sentry, etc.)

---

## Source Pointers

**Authentication:**
- `middleware.ts` - Auth guards
- `lib/auth/session.ts` - Session management
- `app/login/actions.ts` - Login handler

**Signing & Verification:**
- `lib/security/signed-links.ts` - Token generation/verification
- `app/api/stripe/webhook/route.ts` - Webhook verification

**Authorization:**
- `middleware.ts` - Route protection
- `lib/auth/ops-password.ts` - Password verification

---

## Open Questions / Risks

None identified. Security architecture is appropriate for the threat model.

---

**Last Updated:** 2025-12-29
