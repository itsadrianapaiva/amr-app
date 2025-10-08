import { test, expect, request as pwRequest } from "@playwright/test";

/**
 * Remote smoke targets a **running staging site**.
 * - Uses baseURL from playwright.config.ts (APP_URL / NEXT_PUBLIC_APP_URL).
 * - Your config already injects `x-e2e-secret` into default requests when E2E_SECRET is set.
 * - For the "no header" negative case, we spawn a fresh APIRequestContext without extra headers.
 */

const BASE =
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  ""; // absolute base for explicit contexts

test.describe("Remote smoke on staging", () => {
  test("Homepage loads and exposes JSON-LD", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/AMR|Machinery|Rentals/i);

    // Find at least one JSON-LD block and validate it parses
    const jsonLdHandles = await page.locator('script[type="application/ld+json"]').all();
    expect(jsonLdHandles.length).toBeGreaterThan(0);

    // Parse all JSON-LD blocks; pass if at least one contains a known @type
    let foundKnownType = false;
    for (const h of jsonLdHandles) {
      const raw = await h.textContent();
      if (!raw) continue;
      try {
        const data = JSON.parse(raw);
        const arr = Array.isArray(data) ? data : [data];
        const types = arr.map((o) => (o && typeof o === "object" ? (o as any)["@type"] : undefined));
        if (types.some((t) => /Organization|Product|FAQPage/i.test(String(t)))) {
          foundKnownType = true;
          break;
        }
      } catch {
        // ignore parse errors from templated blocks
      }
    }
    expect(foundKnownType).toBeTruthy();
  });

  test("Env check endpoint responds with JSON", async ({ request }) => {
    const res = await request.get("/api/env-check");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(typeof body).toBe("object");
    // Best-effort sanity: ensure it includes something indicative (don’t overfit)
    const keys = Object.keys(body || {});
    expect(keys.length).toBeGreaterThan(0);
  });

  test("Dev probe is gated without header and OK with header", async ({ request }) => {
    // Negative: create a header-less context to simulate missing x-e2e-secret
    const ctx = await pwRequest.newContext({ baseURL: BASE }); // no extraHTTPHeaders here
    const resNoHdr = await ctx.get("/api/dev/ops-verify-password");
    expect([401, 403]).toContain(resNoHdr.status());
    await ctx.dispose();

    // Positive: default request fixture already carries x-e2e-secret from config
    const resWithHdr = await request.get("/api/dev/ops-verify-password");
    expect(resWithHdr.status()).toBe(200);
    const json = await resWithHdr.json();
    expect(typeof json).toBe("object");
    expect(json).toHaveProperty("envUsed"); // same resolver used in prod codepath
  });
});
