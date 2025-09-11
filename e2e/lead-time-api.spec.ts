import { test, expect } from "@playwright/test";
import { computeEarliestStartYmd, addDaysYmd } from "./utils/dates";

const APP_URL =
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://127.0.0.1:3000";

const HEAVY_MACHINE_ID = Number(process.env.TEST_HEAVY_MACHINE_ID || 7);

test.describe("Lead-time server guard (heavy machines)", () => {
  test("rejects booking whose start is before earliest", async ({ request }) => {
    const earliest = computeEarliestStartYmd(new Date(), 2, 15);
    const tooSoonStart = addDaysYmd(earliest, -1);
    const tooSoonEnd = earliest;

    const res = await request.post(`${APP_URL}/api/dev/create-booking`, {
      headers: { "Content-Type": "application/json" },
      data: {
        machineId: HEAVY_MACHINE_ID,
        startYmd: tooSoonStart,
        endYmd: tooSoonEnd,
        email: `e2e-leadtime-before-${Date.now()}@tests.local`,
      },
    });

    const body = await res.text().catch(() => "");
    test.info().annotations.push({
      type: "leadtime-before",
      description: `status=${res.status()} body=${body.slice(0, 400)}`,
    });

    expect(res.ok(), `Expected non-OK when start < earliest; got ${res.status()}`).toBeFalsy();
  });

  test("accepts booking whose start is safely after earliest (earliest + 3)", async ({ request }) => {
    const earliest = computeEarliestStartYmd(new Date(), 2, 15);
    const start = addDaysYmd(earliest, 3);
    const end = addDaysYmd(start, 1);

    const res = await request.post(`${APP_URL}/api/dev/create-booking`, {
      headers: { "Content-Type": "application/json" },
      data: {
        machineId: HEAVY_MACHINE_ID,
        startYmd: start,
        endYmd: end,
        email: `e2e-leadtime-after-${Date.now()}@tests.local`,
        // If your dev route expects more fields, we’ll patch once we see the contract.
        // Example candidates (commented until we confirm):
        // service: "warehouse", // or "delivery" | "pickup"
        // siteAddress: "Lagos, PT",
      },
    });

    const body = await res.text().catch(() => "");
    test.info().annotations.push({
      type: "leadtime-after",
      description: `status=${res.status()} body=${body.slice(0, 400)}`,
    });

    expect(res.ok(), `Expected OK when start >= earliest; got ${res.status()} body=${body.slice(0, 200)}`)
      .toBeTruthy();
  });
});
