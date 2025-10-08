// e2e/ops-guards.spec.ts
import { test, expect, request as pwRequest } from "@playwright/test";

/**
 * Validates security + routing invariants for the Ops dashboard.
 * Assumes matrix flags are injected via workflow:
 *   - OPS_DASHBOARD_ENABLED=1
 *   - OPS_DISABLE_AUTH=0   (auth enabled)
 * And that playwright.config.ts auto-sends x-e2e-secret when present.
 */

function join(host: string, path: string) {
  return host.replace(/\/+$/, "") + path;
}

test.describe("Ops guards & canonical behavior", () => {
  test("unauthenticated /ops-admin redirects to same-origin /login?next=%2Fops-admin", async ({ page, baseURL }) => {
    await page.goto("/ops-admin");
    const url = page.url();
    expect(url.startsWith(join(baseURL!, "/login"))).toBeTruthy();
    expect(url).toContain("next=%2Fops-admin"); // encoded /ops-admin
  });

  test("logout uses relative Location and clears cookie", async ({ request }) => {
    const res = await request.get("/logout", { maxRedirects: 0 });
    expect([302, 303, 307, 308]).toContain(res.status());

    const location = res.headers()["location"] ?? "";
    // Must be relative to avoid cross-origin prefetch issues
    expect(location.startsWith("/")).toBeTruthy();

    const setCookie = res.headers()["set-cookie"] ?? "";
    // Cookie name per project: amr_ops (set in your app)
    expect(setCookie).toMatch(/amr_ops=;/);
  });

  test("dev probe is gated without x-e2e-secret and allowed with it", async ({ request, baseURL }) => {
    // Negative: header-less context should be 401/403
    const ctx = await pwRequest.newContext({ baseURL }); // no global extraHTTPHeaders
    const resNoHeader = await ctx.get("/api/dev/ops-verify-password");
    expect([401, 403]).toContain(resNoHeader.status());
    await ctx.dispose();

    // Positive: default fixture sends x-e2e-secret from config; expect 200 + resolver metadata
    const resWithHeader = await request.get("/api/dev/ops-verify-password");
    expect(resWithHeader.status()).toBe(200);
    const json = await resWithHeader.json();
    expect(json).toHaveProperty("envUsed");
  });
});
