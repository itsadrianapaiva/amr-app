import { test, expect } from "@playwright/test";

/**
 * CI sets E2E_MODE to one of: prod-sim | staging-sim | staging-auth
 * and wires OPS_DASHBOARD_ENABLED / OPS_DISABLE_AUTH accordingly.
 *
 * We probe /ops-admin with the request client to get clean HTTP statuses
 * without SPA/client-side routing noise. Assertions are tolerant so they
 * pass before the admin UI exists, but still protect prod from leaks.
 */

const MODE = process.env.E2E_MODE ?? "staging-sim";

// Simple helpers
const is2xx = (s: number) => s >= 200 && s <= 299;
const is3xx = (s: number) => s >= 300 && s <= 399;

test.describe("Ops Admin visibility guard", () => {
  test("behavior matches CI mode", async ({ request }) => {
    const target = "/ops-admin";
    const res = await request.get(target);
    const status = res.status();
    const finalUrl = res.url(); // if the request client follows redirects, this is the final URL

    if (MODE === "prod-sim") {
      // Must NOT be publicly visible in prod simulation.
      // Acceptable: 404, 401/403, or any non-2xx. If your stack returns a 404 page with 404 status, this will hold.
      expect(is2xx(status)).toBeFalsy();
    }

    if (MODE === "staging-sim") {
      // Dashboard enabled and auth relaxed: should be reachable without redirect to /login.
      // Accept 2xx or 3xx that still ends at /ops-admin (some frameworks might 3xx to add a trailing slash).
      expect(is2xx(status) || is3xx(status)).toBeTruthy();
      expect(finalUrl.includes("/ops-admin")).toBeTruthy();
    }

    if (MODE === "staging-auth") {
      // Dashboard enabled but auth required: either redirects to /login or blocks with 401/403.
      const redirectedToLogin = finalUrl.includes("/login");
      const blocked = status === 401 || status === 403;
      expect(redirectedToLogin || blocked).toBeTruthy();
    }
  });
});
