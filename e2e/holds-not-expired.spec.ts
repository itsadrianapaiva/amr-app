import { test, expect } from "@playwright/test";

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

test("fresh holds are NOT cancelled by cron", async ({ request }) => {
  // Arrange: choose a near-future window
  const start = new Date();
  start.setDate(start.getDate() + 6);
  const end = new Date(start);
  end.setDate(start.getDate() + 2);

  // Create a normal (non-expired) hold
  const createUrl = [
    "/api/dev/create-booking",
    `?machineId=1`,
    `&startDate=${fmt(start)}`,
    `&endDate=${fmt(end)}`,
    `&name=E2E Fresh Hold`,
    `&email=e2e+fresh_${Date.now()}@example.com`,
    `&phone=%2B351000000001`,
    `&totalEuros=99`,
  ].join("");

  const createRes = await request.get(createUrl, {
    headers: { "Cache-Control": "no-store" },
  });
  expect(createRes.ok()).toBeTruthy();
  const created = await createRes.json();
  expect(created?.ok).toBe(true);
  const bookingId: number = created.bookingId;

  // Sanity: was created as PENDING and not expired
  const initial = await request.get(`/api/dev/inspect-booking?id=${bookingId}`, {
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
  const secret = process.env.CRON_SECRET;
  if (secret) headers["x-cron-secret"] = secret;

  const cronRes = await request.get(`/api/cron/expire-holds`, { headers });
  expect(cronRes.ok()).toBeTruthy();
  const cronJson = await cronRes.json();
  expect(cronJson?.ok).toBe(true);

  // Assert: booking remains PENDING
  const after = await request.get(
    `/api/dev/inspect-booking?id=${bookingId}&noCache=${Date.now()}`,
    { headers: { "Cache-Control": "no-store" } }
  );
  expect(after.ok()).toBeTruthy();
  const afterJson = await after.json();
  const statusAfter = afterJson?.booking?.status ?? afterJson?.status;
  expect(statusAfter).toBe("PENDING");
});
