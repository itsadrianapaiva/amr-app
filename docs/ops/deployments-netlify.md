# Deployments (Netlify)

Documentation of Netlify deployment configuration and procedures.

## Build Contexts

**File:** `netlify.toml`

### Production (main branch)

```toml
[context.production]
command = "node scripts/netlify-build.js"
environment = { RUN_MIGRATIONS = "1" }
```

- Runs migrations via `netlify-build.js`
- Uses live Stripe/Vendus keys
- Full authentication required
- Base URL: `https://amr-rentals.com`

### Staging (staging branch)

```toml
[context.branch-deploy]
command = "node scripts/netlify-build.js"
environment = { RUN_MIGRATIONS = "1", NEXT_UNOPTIMIZED_IMAGES = "1" }
```

- Runs migrations
- Uses test Stripe/Vendus keys
- Full authentication required
- Base URL: `$DEPLOY_PRIME_URL` (Netlify-provided)

### Deploy Previews (PRs)

```toml
[context.deploy-preview]
command = "next build"
environment = { RUN_MIGRATIONS = "0", OPS_DISABLE_AUTH = "1" }
```

- **No migrations** (fast smoke testing)
- Auth bypass enabled
- Uses test keys
- Base URL: `$DEPLOY_PRIME_URL`

---

## Migration Policy

### Build Script

**File:** `scripts/netlify-build.js`

```javascript
if (process.env.RUN_MIGRATIONS === "1") {
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
}
execSync("next build", { stdio: "inherit" });
```

**Behavior:**
- **Production & Staging**: `RUN_MIGRATIONS=1` → migrations run
- **Deploy Previews**: `RUN_MIGRATIONS=0` → skip migrations

**Why Skip on Previews:**
- Fast feedback (no DB changes)
- Prevent schema conflicts
- Safe for automated PR testing

---

## Branch Strategy

```
main (protected)
  └─ Production deploy → amr-rentals.com

staging (long-lived)
  └─ Staging deploy → staging URL

feature/* (short-lived)
  └─ Deploy preview → unique preview URL
```

**Release Flow:**
1. Feature branch → PR to staging
2. Verify on staging deploy
3. Merge to staging
4. Small PR: staging → main
5. Production deploy

**Rollback:**
```bash
git revert <commit>
git push origin main
```

**See:** `docs/Git-Workflow.md` for detailed git procedures

---

## Prisma Configuration

**File:** `prisma/schema.prisma`

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")  // Runtime (pooled)
  directUrl = env("DIRECT_URL")    // Migrations (direct)
}
```

**Why Two URLs:**
- `DATABASE_URL`: Prisma Accelerate connection pooling
- `DIRECT_URL`: Direct PostgreSQL for migrations/studio

**Migration Command:**
```bash
npx prisma migrate deploy  # Production/staging
npx prisma migrate dev     # Local development
```

---

## Deployment Checklist

### Pre-Deploy (Production)

- [ ] All tests passing (unit, integration, E2E)
- [ ] Staging verified with production-like data
- [ ] Environment variables reviewed
- [ ] Migration tested on staging first
- [ ] No pending schema changes
- [ ] Stripe webhooks configured for prod endpoint

### Post-Deploy (Production)

- [ ] Verify build logs (migrations ran successfully)
- [ ] Smoke test critical flows:
  - [ ] Homepage loads
  - [ ] Booking form works
  - [ ] Stripe checkout creates
  - [ ] Webhook endpoint responds (trigger test event)
  - [ ] Ops dashboard accessible
- [ ] Check function logs for errors
- [ ] Verify analytics firing

---

## Middleware Canonicalization

**File:** `middleware.ts` (lines 37-66)

**Production Behavior:**
```typescript
const PROD_HOSTS = ["algarvemachinery.netlify.app", "www.amr-rentals.com"];

if (isProdHost && isOpsSurface && reqHost !== "amr-rentals.com") {
  return NextResponse.redirect("https://amr-rentals.com" + pathname);
}
```

**Purpose:**
- Prevents session issues across Netlify deploy-hash subdomains
- Ensures ops routes always use canonical domain
- Applies only to `/ops-admin` and `/api/ops-admin`

---

## Rollback Procedures

### Immediate Rollback (Netlify UI)

1. Go to Netlify Dashboard > Deploys
2. Find last known good deploy
3. Click "Publish deploy"
4. Verify production is restored

**Note:** Does not revert database migrations

### Code Rollback (Git)

```bash
# Revert specific commit
git revert <commit-sha>
git push origin main

# Revert merge commit
git revert -m 1 <merge-sha>
git push origin main

# Back-merge to staging
git checkout staging
git merge main
git push origin staging
```

### Database Rollback

**Caution:** Database rollbacks are risky. Migrations are forward-only by design.

**Safe Approach:**
1. Deploy fix-forward migration
2. Avoid destructive down migrations
3. Test migration thoroughly on staging first

**Emergency:**
```bash
# Restore from backup (coordinate with DB provider)
# Create compensating migration
npx prisma migrate dev --name rollback_<feature>
```

---

## Common Deploy Issues

### Issue: Build fails with Prisma error

**Symptom:** `Error: @prisma/client did not initialize yet`

**Cause:** Missing `npx prisma generate` after schema changes

**Fix:**
```bash
npx prisma generate
git add prisma/
git commit -m "chore: regenerate prisma client"
git push
```

### Issue: Middleware 404s after deploy

**Symptom:** `/ops-admin` returns 404

**Cause:** `OPS_DASHBOARD_ENABLED !== "1"`

**Fix:** Set environment variable in Netlify UI

### Issue: Webpack chunk errors

**Symptom:** `ChunkLoadError` in browser console

**Cause:** Deploy replaced JS chunks while user had old page loaded

**Mitigation:**
- Normal behavior (user refresh resolves)
- Implement service worker for offline support (optional)

---

## Source Pointers

**Build Configuration:**
- `netlify.toml` - Build contexts
- `scripts/netlify-build.js` - Build script
- `next.config.mjs` - Next.js configuration

**Middleware:**
- `middleware.ts` - Canonicalization and auth

**Database:**
- `prisma/schema.prisma` - Data model
- `prisma/migrations/` - Migration history

---

**Last Updated:** 2025-12-29
