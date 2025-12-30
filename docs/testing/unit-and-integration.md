# Unit & Integration Tests

Documentation for unit and integration testing infrastructure.

## Overview

**Unit Tests:** Pure functions, utilities, business logic
**Integration Tests:** Full API routes with real database (testcontainers)
**Tool:** Vitest

---

## Configuration

**File:** `vitest.config.ts`

### Environment Defaults

```typescript
// Injected for tests only
if (!process.env.INVOICING_LINK_SECRET || process.env.INVOICING_LINK_SECRET.length < 24) {
  process.env.INVOICING_LINK_SECRET = "test_secret_0123456789abcdef_TEST_ONLY_SECRET";
}

if (!process.env.APP_URL) {
  process.env.APP_URL = "http://localhost:3000";
}
```

### Path Aliases

```typescript
resolve: {
  alias: [
    { find: "@", replacement: path.resolve(__dirname, ".") },
    { find: "server-only", replacement: path.resolve(__dirname, "tests/shims/server-only.ts") }
  ]
}
```

### Test Environment

- Node.js (not jsdom/browser)
- Include: `tests/**/*.{test,spec}.ts`
- Exclude: `e2e/`, `node_modules/`
- Setup files: `tests/setup/silence-geo-logs.ts`

---

## Running Tests

```bash
# Watch mode
npm test

# CI mode (once, no watch)
npm run test:ci

# Integration tests (testcontainers)
npm run test:integration
```

---

## Unit Test Patterns

### Pure Function Testing

**Example:** `tests/unit/invoicing/vendus.http.contract.spec.ts`

```typescript
describe("buildFullCheckoutSessionParams", () => {
  it("builds mode=payment session with fixed PT VAT", () => {
    const params = buildFullCheckoutSessionParams(makeArgs());
    expect(params.mode).toBe("payment");
  });
});
```

### Zod Schema Testing

**Example:** `tests/unit/validation/booking.spec.ts`

```typescript
it("validates rental days >= minDays", () => {
  const schema = buildBookingSchema(minStart, 3);
  expect(() => schema.parse({ dateRange: { from, to } })).toThrow();
});
```

---

## Integration Test Patterns

### Testcontainers PostgreSQL

**File:** `tests/integration/stripe/checkout-full.test.ts`

```typescript
beforeAll(async () => {
  container = await new PostgreSqlContainer().start();
  process.env.DATABASE_URL = container.getConnectionString();
});

afterAll(async () => {
  await container.stop();
});
```

**Purpose:** Real PostgreSQL for testing Prisma queries

---

## Test Helpers

### Stripe Webhook Signing

**File:** `tests/helpers/stripe-webhook.ts`

```typescript
export function signatureFor(payloadString: string): string {
  return Stripe.webhooks.generateTestHeaderString({
    payload,
    secret: pickSecret()
  });
}
```

### Log Silencing

**File:** `tests/setup/silence-geo-logs.ts`

Filters noisy `[geo]` log messages during tests

---

## Test Organization

```
/tests
├─ /unit               # Pure function tests
│  ├─ /invoicing       # Invoice logic
│  ├─ /stripe          # Stripe helpers
│  └─ /validation      # Zod schemas
├─ /integration        # API + DB tests
│  └─ /stripe          # Stripe webhook integration
├─ /helpers            # Test utilities
└─ /shims              # React/server-only mocks
```

---

## Source Pointers

**Configuration:**
- `vitest.config.ts` - Test environment setup

**Unit Tests:**
- `tests/unit/**/*.spec.ts`

**Integration Tests:**
- `tests/integration/**/*.test.ts`

**Helpers:**
- `tests/helpers/stripe-webhook.ts`
- `tests/setup/silence-geo-logs.ts`

---

**Last Updated:** 2025-12-29
