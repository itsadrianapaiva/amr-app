# Adding Features

Development patterns and conventions for adding new features.

## Directory Structure

```
/app                    # Next.js App Router
├─ /api                 # API Route Handlers
├─ /[feature]           # Feature pages
└─ actions.ts           # Server Actions

/lib                    # Business logic (domain modules)
├─ /repos               # Data repositories
├─ /[domain]            # Domain modules
└─ /validation          # Zod schemas

/components             # React components
└─ /[feature]           # Feature components

/prisma                 # Database
├─ schema.prisma        # Data model
└─ /migrations          # Migration SQL

/tests, /e2e            # Tests
```

---

## Path Aliases

**All imports use `@/` prefix:**

```typescript
import { db } from "@/lib/db";
import BookingForm from "@/components/booking/booking-form";
import { BookingStatus } from "@prisma/client";
```

**Configuration:** `tsconfig.json`, `vitest.config.ts`

---

## Adding an API Route

### 1. Create Route Handler

**File:** `app/api/[feature]/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";  // or "edge"
export const dynamic = "force-dynamic";  // or revalidate

export async function GET(req: NextRequest) {
  // Implementation
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  // Implementation
  return NextResponse.json({ ok: true });
}
```

### 2. Add Validation

```typescript
import { z } from "zod";

const schema = z.object({
  field: z.string().min(1)
});

const validated = schema.parse(body);
```

### 3. Add Tests

**File:** `tests/integration/[feature].test.ts`

```typescript
describe("GET /api/[feature]", () => {
  it("returns expected data", async () => {
    const res = await fetch(`${BASE_URL}/api/[feature]`);
    expect(res.status).toBe(200);
  });
});
```

---

## Adding a Page

### 1. Create Page Component

**File:** `app/[feature]/page.tsx`

```typescript
export const dynamic = "force-dynamic";  // If needed

export default async function FeaturePage() {
  // Server Component - can query DB directly
  const data = await db.model.findMany();

  return <div>...</div>;
}
```

### 2. Add Metadata

```typescript
export const metadata = {
  title: "Feature | AMR",
  description: "..."
};
```

### 3. Add Client Interactivity

**File:** `components/[feature]/feature-form.tsx`

```typescript
"use client";

export function FeatureForm() {
  // Client component for interactivity
  return <form>...</form>;
}
```

---

## Database Migrations

### 1. Modify Schema

**File:** `prisma/schema.prisma`

```prisma
model NewModel {
  id Int @id @default(autoincrement())
  name String
}
```

### 2. Create Migration

```bash
npx prisma migrate dev --name add_new_model
```

### 3. Generate Client

```bash
npx prisma generate
```

### 4. Test Migration

```bash
# Apply to clean database
npm run db:clean
npx prisma migrate dev
npm run db:seed
```

---

## Testing New Features

### Unit Tests

**File:** `tests/unit/[feature].spec.ts`

```typescript
import { describe, it, expect } from "vitest";

describe("feature function", () => {
  it("behaves correctly", () => {
    expect(fn()).toBe(expected);
  });
});
```

### E2E Tests

**File:** `e2e/[feature].spec.ts`

```typescript
import { test, expect } from "@playwright/test";

test("feature flow works", async ({ page }) => {
  await page.goto("/feature");
  // Test interactions
});
```

---

## Code Style

### Server Actions

```typescript
"use server";

export async function featureAction(prevState, formData) {
  // Validate
  // Execute
  // Return state
  return { ok: true };
}
```

### Error Handling

```typescript
try {
  // Operation
} catch (err) {
  if (err.code === "P2002") {
    // Handle unique constraint
  }
  throw err;  // Re-throw unknown errors
}
```

---

## Source Pointers

**Conventions:** [CLAUDE.md](../../CLAUDE.md) - Complete development guide

---

**Last Updated:** 2025-12-29
