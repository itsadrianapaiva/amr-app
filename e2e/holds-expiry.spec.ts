import { test, expect } from "@playwright/test";

/**
 * Purpose:
 * - Create a PENDING booking whose hold is already expired (via dev route flags).
 * - Call the cron endpoint (with x-cron-secret when configured).
 * - Verify the booking flips to CANCELLED.
 *
 * Notes:
 * - Switch to POST with JSON to match the route’s primary path.
 * - Ensure end is derived from start (previous code used new Date()).
 * - Poll briefly after cron to avoid timing flakes.
 */

function fmt(d: Date) {
  // YYYY-MM-DD in UTC to keep it stable across CI timezones
  return d.toISOString().slice(0, 10);
}

test("expired holds get cancelled by cron", async ({ request }) => {
  // --- Arrange: choose a valid future window (3-day rental)
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 3);

  const end = new Date(start);          // derive from start, not from "now"
  end.setUTCDate(end.getUTCDate() + 2); // +2 days → 3-day window

  // --- Arrange: create an already-expired hold (10 minutes in the past)
  const createRes = await request.post("/api/dev/create-booking", {
    headers: {
      "Cache-Control": "no-store",
      "content-type": "application/json",
    },
    data: JSON.stringify({
      machineId: 1,
      startDate: fmt(start),
      endDate: fmt(end),
      name: "E2E Expired Hold",
      email: `e2e+expired_${Date.now()}@example.com`,
      phone: "+351000000000",
      totalEuros: 123,
      expired: true,
      minutes: 10,
    }),
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
  expect(typeof cronJson.cancelled).toBe("number");

  // --- Assert: booking becomes CANCELLED (poll up to ~2s to avoid flakes)
  const started = Date.now();
  let cancelled = false;
  while (Date.now() - started < 2000) {
    const inspectRes = await request.get(
      `/api/dev/inspect-booking?id=${bookingId}&noCache=${Date.now()}`,
      { headers: { "Cache-Control": "no-store" } }
    );
    expect(inspectRes.ok()).toBeTruthy();
    const inspected = await inspectRes.json();
    const status = inspected?.booking?.status ?? inspected?.status;
    if (status === "CANCELLED") {
      cancelled = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 150));
  }

  expect(cancelled).toBe(true);
});
