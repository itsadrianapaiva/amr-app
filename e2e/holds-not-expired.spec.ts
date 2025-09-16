import { test, expect, APIRequestContext } from "@playwright/test";

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Robust creator: POST + retries, mirrors other specs to avoid overlap flakes.
async function createBookingWithRetry(request: APIRequestContext) {
  const BASE_URL =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://127.0.0.1:8888";

  const base = new Date();
  const jitter = Date.now() % 30; // per-run jitter
  const machineId = 1; // avoid heavy transport rule

  for (let attempt = 0; attempt < 5; attempt++) {
    const start = new Date(base);
    start.setUTCDate(start.getUTCDate() + 180 + jitter + attempt * 10);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 2); // 3-day inclusive

    const res = await request.post(`${BASE_URL}/api/dev/create-booking`, {
      headers: { "content-type": "application/json" },
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

    const status = res.status();
    const text = await res.text();
    if (status === 400 && text.includes("Selected dates are no longer available")) {
      continue; // shift window and retry
    }
    throw new Error(`create-booking failed: HTTP ${status} — ${text}`);
  }

  throw new Error("create-booking failed after retries due to overlapping dates.");
}

test("fresh holds are NOT cancelled by cron", async ({ request }) => {
  const BASE_URL =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://127.0.0.1:8888";

  // Arrange: create a normal, non-expired PENDING hold
  const { bookingId } = await createBookingWithRetry(request);

  // Sanity: it’s PENDING and not expired
  const initial = await request.get(`${BASE_URL}/api/dev/inspect-booking?id=${bookingId}`, {
    headers: { "Cache-Control": "no-store" },
  });
  expect(initial.ok()).toBeTruthy();
  const initialJson = await initial.json();
  const initialStatus = initialJson?.booking?.status ?? initialJson?.status;
  const initialHold = new Date(
    initialJson?.booking?.holdExpiresAt ?? initialJson?.holdExpiresAt
  ).getTime();
  expect(initialStatus).toBe("PENDING");
  expect(initialHold).toBeGreaterThan(Date.now()); // not expired

  // Act: run cron
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  const secret = process.env["CRON_SECRET"];
  if (secret) headers["x-cron-secret"] = secret;

  const cronRes = await request.get(`${BASE_URL}/api/cron/expire-holds`, { headers });
  expect(cronRes.ok()).toBeTruthy();
  const cronJson = await cronRes.json();
  expect(cronJson?.ok).toBe(true);

  // Assert: booking remains PENDING
  const after = await request.get(
    `${BASE_URL}/api/dev/inspect-booking?id=${bookingId}&noCache=${Date.now()}`,
    { headers: { "Cache-Control": "no-store" } }
  );
  expect(after.ok()).toBeTruthy();
  const afterJson = await after.json();
  const statusAfter = afterJson?.booking?.status ?? afterJson?.status;
  expect(statusAfter).toBe("PENDING");
});
