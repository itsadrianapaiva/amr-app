import { test, expect, APIRequestContext } from "@playwright/test";
import { computeEarliestStartYmd, addDaysYmd } from "./utils/dates";

const APP_URL =
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://127.0.0.1:3000";

// Heavy machines are 5/6/7. Route will auto-fallback to a valid ID in dev if it doesn't exist.
const HEAVY_MACHINE_ID = Number(process.env.TEST_HEAVY_MACHINE_ID || 7);

/** Tiny helper: post to dev create route, return raw Response and body text (for diagnostics). */
async function postCreateBooking(
  request: APIRequestContext,
  payload: Record<string, any>
) {
  const res = await request.post(`${APP_URL}/api/dev/create-booking`, {
    headers: { "Content-Type": "application/json" },
    data: payload,
  });
  const text = await res.text().catch(() => "");
  return { res, text };
}

test.describe("Lead-time server guard (heavy machines)", () => {
  test("rejects booking whose start is before earliest", async ({ request }) => {
    const earliest = computeEarliestStartYmd(new Date(), 2, 15);
    const tooSoonStart = addDaysYmd(earliest, -1);
    const tooSoonEnd = earliest; // minimum 1-day span

    const { res, text } = await postCreateBooking(request, {
      machineId: HEAVY_MACHINE_ID,
      startDate: tooSoonStart, // IMPORTANT: route expects startDate/endDate
      endDate: tooSoonEnd,
      email: `e2e-leadtime-before-${Date.now()}@tests.local`,
    });

    test.info().annotations.push({
      type: "leadtime-before",
      description: `status=${res.status()} body=${text.slice(0, 300)}`,
    });
    expect(res.ok(), `Expected non-OK when start < earliest; got ${res.status()}`).toBeFalsy();
  });

  test("accepts booking whose start is safely after earliest (earliest + 3)", async ({ request }) => {
    const earliest = computeEarliestStartYmd(new Date(), 2, 15);
    const start = addDaysYmd(earliest, 3);
    const end = addDaysYmd(start, 1);

    const { res, text } = await postCreateBooking(request, {
      machineId: HEAVY_MACHINE_ID,
      startDate: start,   // IMPORTANT: correct keys for the route DTO
      endDate: end,
      email: `e2e-leadtime-after-${Date.now()}@tests.local`,
    });

    test.info().annotations.push({
      type: "leadtime-after",
      description: `status=${res.status()} body=${text.slice(0, 300)}`,
    });
    expect(res.ok(), `Expected OK when start >= earliest; got ${res.status()} body=${text.slice(0, 200)}`).toBeTruthy();
  });
});

test.describe("Overlap guard (inclusive tsrange on same machine)", () => {
  test("second overlapping booking is rejected", async ({ request }) => {
    // Pick a range far enough out to avoid lead-time or prior data collisions
    const anchor = addDaysYmd(computeEarliestStartYmd(new Date(), 2, 15), 7);
    const end = addDaysYmd(anchor, 2); // 3-day span: anchor..anchor+2

    // First booking should succeed
    const first = await postCreateBooking(request, {
      machineId: HEAVY_MACHINE_ID,
      startDate: anchor,
      endDate: end,
      email: `e2e-overlap-a-${Date.now()}@tests.local`,
    });
    expect(first.res.ok(), `First booking should be OK; got ${first.res.status()} body=${first.text.slice(0, 200)}`).toBeTruthy();

    // Second booking overlaps the same range (same machine, different email) → expect non-OK
    const second = await postCreateBooking(request, {
      machineId: HEAVY_MACHINE_ID,
      startDate: addDaysYmd(anchor, 1), // overlaps middle day
      endDate: end,
      email: `e2e-overlap-b-${Date.now()}@tests.local`,
    });

    expect(
      second.res.ok(),
      `Expected non-OK for overlapping range; got ${second.res.status()} body=${second.text.slice(0, 200)}`
    ).toBeFalsy();
  });
});
