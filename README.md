# Algarve Machinery Rentals - Backend System

A production-grade machinery rental platform for handling online bookings, full payment processing, automated invoicing, and operational management. This system processes real customer transactions and is designed with strong guarantees around transactional correctness, payment reliability, and auditability, with specific compliance for the Portuguese invoicing and tax environment.

The backend is built on **Next.js 15 (App Router)** with TypeScript and serves a REST-like API consumed by a server-rendered frontend. Business logic is executed server-side, with strict separation between critical synchronous paths and asynchronous side effects.

> This README is a high-level orientation document.  
> **All authoritative and up-to-date technical documentation lives in `/docs`.**  
> If there is any discrepancy, `/docs` is the source of truth.

---

## Documentation

Comprehensive technical documentation is maintained in the [`/docs`](docs/index.md) directory.

Key entry points:

- **[Architecture](docs/architecture/overview.md)**  
  System design, data model, and core workflows

- **[Operations](docs/ops/runbooks.md)**  
  Deployment, environment configuration, and production runbooks

- **[Testing](docs/testing/e2e.md)**  
  End-to-end, unit, and integration testing strategy

- **[Security](docs/security/security-notes.md)**  
  Security architecture, trust boundaries, and threat model

- **[Development](docs/development/local-setup.md)**  
  Local setup, development patterns, and contribution guidelines

- **[Reference](docs/reference/api-routes.md)**  
  API routes and environment variables reference

Development rules and implementation constraints for automated code changes are defined in **[CLAUDE.md](CLAUDE.md)**.

---

## System Overview

The system follows a domain-driven organization where business logic is grouped by responsibility rather than technical layer.

- Core backend logic lives in `/lib`, organized by domain (booking, payments, invoicing, auth, notifications).
- API routes in `/app/api` act as thin handlers responsible for validation, authorization, and delegation.
- Persistence is isolated behind repositories to keep business rules independent from ORM concerns.
- External integrations (Stripe, Vendus, email providers) are encapsulated behind well-defined boundaries.

Public customer-facing APIs, authenticated webhook endpoints, signed invoice delivery links, and role-based operational dashboards are strictly separated.

For full architectural details, see:
- `docs/architecture/overview.md`
- `docs/architecture/booking-and-payments.md`

---

## Core Backend Capabilities (Summary)

- **Booking lifecycle management**  
  State transitions: `PENDING -> CONFIRMED -> CANCELLED`  
  Time-limited holds, overlap detection using PostgreSQL `tsrange`, and concurrency control

- **Payments**  
  Stripe Checkout with card and async methods (MB WAY, SEPA)  
  Webhook-driven confirmation with database-level idempotency

- **Automated invoicing**  
  Vendus API integration for Portuguese tax-compliant documents  
  Secure, time-limited signed PDF links for invoice delivery

- **Asynchronous side effects**  
  Durable job queue for invoice issuance and email notifications  
  Retryable, non-blocking execution to protect critical paths

- **Operational access control**  
  Session-based authentication using signed cookies  
  Role-based access for executives and managers

- **Environment isolation**  
  Distinct behavior for production, staging, and deploy previews  
  Migration policy and auth enforcement vary by environment

Each of these areas is documented in depth under `/docs`.

---

## Data and Persistence (High-Level)

Persistence uses **Prisma ORM with PostgreSQL** and models four main concerns:

- **Inventory**: rental machines, pricing, availability rules
- **Bookings**: customer data, rental periods, payment and invoice state
- **Payments**: Stripe event tracking and refund synchronization
- **Async jobs**: durable processing of side effects

Date ranges are stored in UTC and normalized to Lisbon calendar days. PostgreSQL generated `tsrange` columns are used for efficient overlap detection and availability checks.

Detailed schema documentation is available in:
- `docs/architecture/data-model.md`

---

## Reliability and Production Safety

The system is designed to fail safely:

- Webhook processing is idempotent at the database level
- External service failures (invoicing, email) never block payment confirmation
- Async jobs are retryable with bounded attempts and error capture
- Advisory locks and transaction timeouts prevent race conditions under load
- Structured logs provide operational visibility for debugging and monitoring

Operational procedures and failure modes are documented in:
- `docs/ops/runbooks.md`

---

## Frontend Relationship

The frontend is a server-rendered Next.js application that consumes backend APIs.  
All business rules, validation, pricing logic, and persistence live on the server.  
Frontend components handle only presentation and form state.

---

## Tech Stack

**Backend**
- Next.js 15 (App Router)
- TypeScript
- Prisma ORM
- PostgreSQL
- Stripe API (payments)
- Vendus API (invoicing)
- Resend (transactional email)
- Netlify Functions (deployment and scheduling)

**Frontend**
- React Server Components and Client Components
- Radix UI
- Tailwind CSS
- Mapbox (address validation)

**Testing**
- Vitest (unit tests)
- Testcontainers (integration tests)
- Playwright (end-to-end tests)

**Deployment**
- Netlify with environment-specific build contexts
- Automated migrations in production and staging
- Scheduled job processing for async workflows

---

## Contribution and Maintenance

When making significant system changes:

1. Update the relevant documentation in `/docs`
2. Add source file pointers for new behavior
3. Update runbooks if new failure modes are introduced
4. Keep documentation concise and operational

For implementation constraints and safety rules, always follow **CLAUDE.md** when using AI assistance.
