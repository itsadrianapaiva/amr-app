import { test, expect } from "@playwright/test";

/**
 * Minimal API smoke against /api/dev/geofence-check
 * - Uses APP_URL (or NEXT_PUBLIC_APP_URL) to build the endpoint.
 * - Asserts core contract: Faro IN, Olhão OUT, bad params 400.
 */

const APP_URL =
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://127.0.0.1:8888"; // Aligns with our local defaults

function buildUrl(
  path: string,
  params?: Record<string, number | string>
): string {
  const url = new URL(path, APP_URL);
  if (params) {
    for (const [k, v] of Object.entries(params))
      url.searchParams.set(k, String(v));
  }
  return url.toString();
}

test.describe("Geofence API smoke", () => {
  test("Faro-ish → inside", async ({ request }) => {
    const res = await request.get(
      buildUrl("/api/dev/geofence-check", { lat: 37.02, lng: -7.92 })
    );
    expect(res.status(), "should return 200").toBe(200);
    const json = await res.json();
    expect(json.inside, "Faro should be inside by policy (<= -7.90)").toBe(
      true
    );
    expect(json.serviceArea).toBeTruthy();
  });

  test("Olhão-ish → outside", async ({ request }) => {
    const res = await request.get(
      buildUrl("/api/dev/geofence-check", { lat: 37.03, lng: -7.8 })
    );
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.inside, "Olhão should be outside by policy (> -7.90)").toBe(
      false
    );
  });

  test("Missing params → 400", async ({ request }) => {
    const res = await request.get(
      buildUrl("/api/dev/geofence-check", { lat: 37.1 as unknown as string })
    );
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/missing|invalid/i);
  });
});
