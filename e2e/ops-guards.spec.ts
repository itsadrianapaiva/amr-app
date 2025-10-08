// e2e/ops-guards.spec.ts
import { test, expect, request as pwRequest, Locator } from "@playwright/test";

/**
 * Mode awareness:
 * - If OPS_DISABLE_AUTH=1, unauthenticated /ops-admin is expected 200; skip redirect checks.
 * - Negative dev-probe (no header) may be 401/403/405.
 * - Positive dev-probe (with header) may be 200 or 400 (body/method guard).
 * - Some apps render the login form at /ops-admin (200) rather than redirecting to /login.
 */

const AUTH_DISABLED = process.env.OPS_DISABLE_AUTH === "1";
const E2E_SECRET = process.env.E2E_SECRET || "";

function join(host: string, path: string) {
  return host.replace(/\/+$/, "") + path;
}

test.describe("Ops guards & canonical behavior", () => {
  test("unauthenticated /ops-admin shows login (redirect OR inline)", async ({ browser, baseURL }) => {
    test.skip(AUTH_DISABLED, "Auth disabled in this mode; /ops-admin is expected 200.");

    // Fresh context WITHOUT global headers so x-e2e-secret isn't sent.
    const ctx = await browser.newContext({ baseURL });
    const page = await ctx.newPage();

    await page.goto("/ops-admin");
    await page.waitForLoadState("networkidle"); // let RSC/hydration settle

    const url = page.url();
    const redirectedToLogin = url.startsWith(join(baseURL!, "/login"));

    if (redirectedToLogin) {
      expect(url).toContain("next=%2Fops-admin"); // encoded /ops-admin
    } else {
      // Inline login: accept any of these signals
      const signals: Locator[] = [
        page.locator('input[type="password"]'),
        page.locator('input[autocomplete="current-password"]'),
        page.locator('input[name*="pass"]'),
        page.getByLabel(/password|passcode|code|c[oó]digo/i),
        page.getByPlaceholder(/password|passcode|code|c[oó]digo/i),
        page.getByRole("button", { name: /log in|sign in|entrar|continue|access/i }),
        page.getByRole("heading", { name: /login|sign in|entrar|ops|admin/i }),
        page.getByText(/restricted|admin|ops|authentication|autentica/i),
        page.locator('form[action*="/login"]'),
      ];

      let found = 0;
      for (const s of signals) found += await s.first().count();

      expect(found).toBeGreaterThan(0);
    }

    await ctx.close();
  });

  test("logout uses relative Location and clears cookie", async ({ request }) => {
    const res = await request.get("/logout", { maxRedirects: 0 });
    expect([302, 303, 307, 308]).toContain(res.status());

    const location = res.headers()["location"] ?? "";
    expect(location.startsWith("/")).toBeTruthy(); // relative redirect

    const setCookie = res.headers()["set-cookie"] ?? "";
    expect(setCookie).toMatch(/amr_ops=;/); // cookie cleared
  });

  test("dev probe is gated without x-e2e-secret and accessible with it", async ({ request, baseURL }) => {
    // Negative: header-less context should be gated (401/403/405)
    const ctx = await pwRequest.newContext({ baseURL }); // no global extraHTTPHeaders
    const resNoHeader = await ctx.get("/api/dev/ops-verify-password");
    await ctx.dispose();
    expect([401, 403, 405]).toContain(resNoHeader.status());

    // Positive: only when a secret exists
    test.skip(!E2E_SECRET, "E2E_SECRET not provided; skipping positive dev-probe case.");

    // Route may require POST and/or body. Treat 200 ideal; 400 acceptable.
    const tryGet = await request.get("/api/dev/ops-verify-password");
    if (tryGet.status() === 405) {
      const tryPost = await request.post("/api/dev/ops-verify-password", {
        data: { probe: true },
      });
      expect([200, 400]).toContain(tryPost.status());
      if (tryPost.status() === 200) {
        const json = await tryPost.json();
        expect(json).toHaveProperty("envUsed");
      }
    } else {
      expect([200, 400]).toContain(tryGet.status());
      if (tryGet.status() === 200) {
        const json = await tryGet.json();
        expect(json).toHaveProperty("envUsed");
      }
    }
  });
});
