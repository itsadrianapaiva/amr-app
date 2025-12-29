# AMR Machinery Rental Platform - Documentation

Welcome to the technical documentation for the AMR (Algarve Machinery Rental) platform. This is a production Next.js 14 full-stack application handling online machinery rentals with complete payment processing, automated invoicing, and operational dashboards.

## Quick Links

- [CLAUDE.md](../CLAUDE.md) - Development guide for Claude Code
- [README.md](../README.md) - Technical backend architecture overview
- [Git Workflow](Git-Workflow.md) - Branch model and contribution workflow

---

## Architecture

Understanding the system design, data model, and core workflows.

### [System Overview](architecture/overview.md)
High-level architecture, module boundaries, request flow diagrams, and integration points (Stripe, Vendus, Resend, Mapbox). Start here for the big picture.

### [Data Model](architecture/data-model.md)
Complete Prisma schema documentation covering all models (Machine, Booking, StripeEvent, BookingJob, CompanyDiscount), lifecycle states, tsrange date handling, and database constraints.

### [Booking & Payments](architecture/booking-and-payments.md)
End-to-end booking flow from form submission through Stripe Checkout, webhook processing, payment confirmation (card vs async MB WAY/SEPA), refund handling, and failure modes.

### [Invoicing (Vendus)](architecture/invoicing-vendus.md)
Vendus API integration details including document types, VAT mapping, client resolution, signed invoice links (JWT tokens), PDF proxy implementation, and fallback behaviors.

### [Async Job Queue](architecture/async-jobs.md)
BookingJob model architecture, job types (invoice issuance, email notifications), atomic claiming, retry logic, and cron processor implementation.

### [Notifications & Email](architecture/notifications-email.md)
Email infrastructure using Resend, React Email templates, notification triggers, email tracking timestamps for idempotency, and dry-run mode for development.

---

## Operations

Deployment, environment management, and troubleshooting runbooks.

### [Environments & Secrets](ops/environments-and-secrets.md)
Complete environment variable reference (70+ vars) grouped by subsystem (Database, Stripe, Vendus, Email, Auth, Analytics, etc.), required vs optional per environment, and critical configuration checklists.

### [Deployments (Netlify)](ops/deployments-netlify.md)
Netlify build contexts (production, staging, deploy-preview), migration policy, build scripts, branch strategy, deployment checklists, and rollback procedures.

### [Runbooks](ops/runbooks.md)
Practical troubleshooting guides for common production issues: webhook failures, booking confirmation problems, invoice generation issues, signed link errors, environment mismatches, and stuck job queues.

---

## Testing

E2E, unit, and integration testing infrastructure.

### [E2E Testing (Playwright)](testing/e2e.md)
Playwright configuration, test patterns, x-e2e-secret header for auth bypass, dev-gated routes, database cleanup, running tests locally and in CI, and .env.e2e.local setup.

### [Unit & Integration Tests](testing/unit-and-integration.md)
Vitest configuration, unit test patterns, integration tests with testcontainers, test helpers and utilities, and running the test suites.

---

## Security

Security architecture, threat boundaries, and secrets management.

### [Security Notes](security/security-notes.md)
Trust boundaries, webhook signature verification, signed invoice links (JWT), session cookie security (HMAC-SHA256), secrets hygiene, dev route gating, and auth bypass hierarchy.

---

## Development

Local setup and development patterns.

### [Local Setup](development/local-setup.md)
Prerequisites, installation steps, environment variable configuration, database setup (migrations, seeding), running dev servers, testing Stripe webhooks locally, and common pitfalls.

### [Adding Features](development/adding-features.md)
Directory structure conventions, path aliases (@/*), adding API routes and pages, database migrations workflow, and testing new features.

---

## Reference

API routes and environment variables reference.

### [API Routes](reference/api-routes.md)
Complete inventory of all API routes: customer-facing, webhooks, invoice proxy, cron endpoints, dev-gated routes, and ops admin routes with source file pointers.

### [Environment Variables](reference/environment-variables.md)
Alphabetical reference of all environment variables including name, type (server/public), required status, defaults, usage description, and source file locations.

---

## Changelog

### [Changelog](changelog.md)
Project changelog template for tracking significant changes, features, and fixes.

---

## Contributing

This documentation is maintained alongside the codebase. When making significant changes to the system:

1. Update relevant documentation files to reflect new behavior
2. Add source pointers (file paths) for new features
3. Update runbooks if new failure modes are introduced
4. Keep documentation concise and operational

For questions or issues with the documentation, please reach out to the engineering team.

---

**Last Updated:** 2025-12-29
