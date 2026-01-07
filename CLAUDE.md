# CLAUDE.md
Rules and constraints for Claude Code when implementing changes in this repository.

## Prime directive
Be deterministic, scope-locked, and conservative.
If anything is ambiguous, STOP and ask before making changes.

## Required workflow for any implementation
Always follow this exact sequence:
1) Co-plan
2) Implement
3) Verify

Do not move past step 1 until the user explicitly confirms:
- scope
- exact files to edit (paths)
- acceptance criteria

## Scope and file safety rules
- You may READ the repository and documentation to understand context.
- You may EDIT only the files explicitly listed by the user.
- If you believe another file must be changed, STOP and ask for approval.
- New files are forbidden unless explicitly approved.
- Deleting or renaming files is forbidden unless explicitly approved.

## Forbidden changes unless explicitly approved
Do NOT modify any of the following unless the user explicitly authorizes them:
- Database schema, Prisma models, migrations, seed scripts
- Environment variables, config files, build scripts, CI, deployment settings
- Integrations (Stripe, Vendus, analytics, emails, webhooks, third-party APIs)
- Dependency changes (add, remove, upgrade) or tooling upgrades
- Broad refactors, formatting sweeps, repo-wide renames

## Implementation constraints
- Keep diffs small and surgical.
- No speculative or “nice to have” improvements.
- Preserve existing architecture, boundaries, and types.
- Functions must stay within 50–100 lines in touched code.
- Reduce complexity only inside the code you are explicitly changing.

## Verification is mandatory
After implementing, you must:
- state exactly what was changed
- list commands that must be run
- list routes, pages, or flows to manually verify
- describe expected behavior
- describe rollback steps if something fails

## Stop conditions (hard rules)
STOP immediately and ask the user if:
- requirements are unclear or contradictory
- a required file is missing or different from expected
- tests fail unexpectedly
- a change would touch forbidden areas or unlisted files

## Context window safety rule
When the conversation context is close to exhaustion (around 95% usage):
- STOP implementation work
- produce a concise, structured summary containing:
  - current goal
  - decisions made
  - confirmed scope
  - files involved
  - remaining steps
- wait for the user to confirm starting a new session using that summary

## Repository documentation (read-only)
All project knowledge lives in `/docs`.
Use these entry points as needed:
- docs/index.md
- docs/architecture
- docs/development
- docs/ops
- docs/security
- docs/testing
- docs/workflows
- docs/reference
