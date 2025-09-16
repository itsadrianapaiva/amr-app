import { test, expect } from "@playwright/test";

/**
 * Purpose:
 * - Create a PENDING booking whose hold is already expired (via dev route flags).
 * - Call the cron endpoint (with x-cron-secret when configured).
 * - Verify the booking flips to CANCELLED.
 *
 * Requirements:
 * - APP_URL (used by Playwright baseURL or via process.env.APP_URL)
 * - CRON_SECRET (if your cron route is secured; same value as Netlify env)
 */

function fmt(d: Date) {
  // YYYY-MM-DD for query params
  return d.toISOString().slice(0, 10);
}

test("expired holds get cancelled by cron", async ({ request }) => {
  // --- Arrange: choose dates (any valid future window is fine)
  const start = new Date();
  start.setDate(start.getDate() + 3);
  const end = new Date();
  end.setDate(start.getDate() + 2); // 3-day rental window

  // --- Arrange: create an already-expired hold (10 minutes in the past)
  const createUrl = [
    "/api/dev/create-booking",
    `?expired=true`,
    `&minutes=10`,
    `&machineId=1`,
    `&startDate=${fmt(start)}`,
    `&endDate=${fmt(end)}`,
    `&name=E2E Expired Hold`,
    `&email=e2e+expired@example.com`,
    `&phone=%2B351000000000`,
    `&totalEuros=123`,
  ].join("");

  const createRes = await request.get(createUrl, {
    headers: { "Cache-Control": "no-store" },
  });
  expect(createRes.ok()).toBeTruthy();
  const created = await createRes.json();
  expect(created?.ok).toBe(true);
  const bookingId: number = created.bookingId;
  expect(typeof bookingId).toBe("number");
  expect(created.status).toBe("PENDING");
  expect(Date.parse(created.holdExpiresAt)).toBeLessThan(Date.now());

  // --- Act: trigger the cron route to expire stale holds
  const cronHeaders: Record<string, string> = { "Cache-Control": "no-store" };
  const secret = process.env["CRON_SECRET"];
  if (secret) cronHeaders["x-cron-secret"] = secret;

  const cronRes = await request.get(`/api/cron/expire-holds`, {
    headers: cronHeaders,
  });
  expect(cronRes.ok()).toBeTruthy();
  const cronJson = await cronRes.json();
  expect(cronJson?.ok).toBe(true);
  // Optional sanity: at least 1 cancelled (could be >1 if previous tests left data)
  expect(typeof cronJson.cancelled).toBe("number");

  // --- Assert: booking is now CANCELLED
  const inspectUrl = `/api/dev/inspect-booking?id=${bookingId}&noCache=${Date.now()}`;
  const inspectRes = await request.get(inspectUrl, {
    headers: { "Cache-Control": "no-store" },
  });
  expect(inspectRes.ok()).toBeTruthy();
  const inspected = await inspectRes.json();

  // Example shape tolerance: { ok: true, booking: { id, status, ... } } or flat
  const status = inspected?.booking?.status ?? inspected?.status;
  expect(status).toBe("CANCELLED");
});
