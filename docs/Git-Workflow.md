# AMR Website — Git Workflow

## Branch model

- **main** → production only. Always green. Protected.
- **staging** → long-lived branch deploy on Netlify. Full E2E test bed.
- **feature/\*** → short-lived off `staging`. One feature per branch.
- **hotfix/\*** → short-lived off `main` when prod is broken.

### Lifecycle

- Feature → PR into **staging** → verify on staging branch deploy → merge to **staging** → small PR from **staging** to **main**.
- Hotfix → PR into **main** → after release, back-merge **main** → **staging**.

## Commit & PR rules

- **Small commits** that build and pass tests (≈50–150 LOC). No “WIP” to origin.
- **Conventional Commits**:
  - `feat: add refunds webhook branch`
  - `fix: correct VAT 23% rounding`
  - `refactor: extract geofence util`
  - `test: add holds expiry cron spec`
  - `docs: add env-check usage`
  - `chore: bump prisma to 5.17`
- **PRs**: focused, include Deploy Preview + staging URLs, ≤ ~300 LOC. Use Draft while iterating; self-review before “Ready”.

## Rebase & merge

- Rebase **feature** on `staging` to keep a clean history:
  ```bash
  git fetch origin
  git rebase origin/staging
  git push --force-with-lease
  ```
- Never rebase public branches (`main`, `staging`).

Merge into staging with **Squash and merge** for one tidy feature commit.

### Release & rollback

**Release:**

```bash
git switch main && git pull
git merge --no-ff staging -m "Promote staging to production"
git push origin main
```

**Rollback:**

```bash
git revert <sha>           # single commit
git revert -m 1 <merge>    # revert a merge commit
git push
# then back-merge main -> staging
```

## Daily routine

```bash
git switch staging && git pull

git switch -c feat/<slug>

# Code → small commit → run tests

# Rebase on origin/staging

# Draft PR → CI green → self-review → Ready

# Squash merge to staging; verify on branch deploy

# Small PR staging → main to release
```

## Env & secrets (overview)

- `.env.local` on your machine (test/staging credentials only).
- Netlify UI per context:
  - **Production**: live keys, prod DB.
  - **Branch deploys (staging)**: test keys, staging DB (+ branch override for Stripe webhook secret).
  - **Deploy Previews**: staging DB, no webhooks.
- `netlify.toml` sets `APP_URL` / `NEXT_PUBLIC_APP_URL` per context.
- Never commit secrets; commit `.env.example` only.

## Prisma & DBs

- Two DBs: prod and staging. No prod creds locally.

**schema.prisma:**

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")  // runtime
  directUrl = env("DIRECT_URL")    // migrate deploy (direct postgres://)
}
```

**Build:**

- Production: `npx prisma migrate deploy && next build`
- Branch-deploy: `npx prisma migrate deploy && next build`
- Deploy-preview: `next build` (toggle on if needed)

### Prisma Studio (one-off)

**Staging (macOS/Linux):**

```bash
DATABASE_URL="$DIRECT_URL" npx prisma studio
```

**Staging (PowerShell):**

```powershell
$env:DATABASE_URL=$env:DIRECT_URL; npx prisma studio
```

**Prod (macOS/Linux):**

```bash
DATABASE_URL="postgres://prod_user:***@host:5432/db" npx prisma studio
```

**Prod (PowerShell):**

```powershell
$env:DATABASE_URL="postgres://prod_user:***@host:5432/db"; npx prisma studio
```

---

## Tests flow

### Get tests running again (no code changes)

Your current three-terminal flow is likely double-starting Next:

- **Terminal A**: `npm run dev` (Next on 3000)
- **Terminal B**: `netlify dev` (starts/proxies Next internally)
- **Playwright** may also try to start a `webServer` → port conflict → `config.webServer ... Exit code: 1`.

**Use this simpler 2-terminal recipe:**

**Terminal A — Netlify dev only**

```bash
# From /workspaces/amr-app
npx netlify dev --port 8888
```
