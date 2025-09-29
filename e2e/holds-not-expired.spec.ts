import { test, expect, APIRequestContext } from "@playwright/test";

/**
 * Goal: Create a normal, non-expired PENDING booking and prove
 * the cron does NOT cancel it.
 *
 * Changes:
 * - Use relative URLs (baseURL from Playwright config).
 * - Keep POST JSON body.
 * - Add light jitter + retries to avoid overlap flakes.
 */

function fmt(d: Date) {
  // YYYY-MM-DD in UTC for CI stability
  return d.toISOString().slice(0, 10);
}

// Robust creator: POST + retries, mirrors other specs to avoid overlap flakes.
async function createBookingWithRetry(request: APIRequestContext) {
  const base = new Date();
  const jitter = (Date.now() / 1000) % 30; // per-run jitter
  const machineId = 1; // avoid heavy transport rule

  for (let attempt = 0; attempt < 5; attempt++) {
    const start = new Date(base);
    start.setUTCDate(
      start.getUTCDate() + 30 + Math.floor(jitter) + attempt * 7
    );
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 2); // 3-day window

    const res = await request.post(`/api/dev/create-booking`, {
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
      data: JSON.stringify({
        machineId,
        startDate: fmt(start),
        endDate: fmt(end),
        name: "E2E Fresh Hold",
        email: `e2e+fresh_${Date.now()}@example.com`,
        phone: "+351000000001",
        totalEuros: 99,
      }),
    });

    if (res.ok()) {
      const json = await res.json();
      return {
        bookingId: json.bookingId as number,
        machineId,
      };
    }

    // Overlap? try a later window
    const status = res.status();
    const text = await res.text();
    if (
      status === 400 &&
      /Selected dates are no longer available/i.test(text)
    ) {
      continue;
    }
    throw new Error(`create-booking failed: HTTP ${status} — ${text}`);
  }

  throw new Error(
    "create-booking failed after retries due to overlapping dates."
  );
}

test("fresh holds are NOT cancelled by cron", async ({ request }) => {
  // Arrange: create a normal, non-expired PENDING hold
  const { bookingId } = await createBookingWithRetry(request);

  // Sanity: it’s PENDING and not expired
  const initial = await request.get(
    `/api/dev/inspect-booking?id=${bookingId}`,
    {
      headers: { "cache-control": "no-store" },
    }
  );
  expect(initial.ok()).toBeTruthy();
  const initialJson = await initial.json();
  const initialStatus = initialJson?.booking?.status ?? initialJson?.status;
  const initialHold = new Date(
    initialJson?.booking?.holdExpiresAt ?? initialJson?.holdExpiresAt
  ).getTime();
  expect(initialStatus).toBe("PENDING");
  expect(initialHold).toBeGreaterThan(Date.now());

  // Act: run cron (honor x-cron-secret if configured)
  const headers: Record<string, string> = { "cache-control": "no-store" };
  const secret = process.env.CRON_SECRET;
  if (secret) headers["x-cron-secret"] = secret;

  const cronRes = await request.get(`/api/cron/expire-holds`, { headers });
  expect(cronRes.ok()).toBeTruthy();
  const cronJson = await cronRes.json();
  expect(cronJson?.ok).toBe(true);

  // Assert: booking remains PENDING
  const after = await request.get(
    `/api/dev/inspect-booking?id=${bookingId}&noCache=${Date.now()}`,
    { headers: { "cache-control": "no-store" } }
  );
  expect(after.ok()).toBeTruthy();
  const afterJson = await after.json();
  const statusAfter = afterJson?.booking?.status ?? afterJson?.status;
  expect(statusAfter).toBe("PENDING");
});
