// e2e/lead-time.spec.ts
import { test, expect, Page, Locator } from "@playwright/test";
import { addDaysYmd, computeEarliestStartYmd, parseYmd } from "./utils/dates";

// Gate this UI test behind an env flag.
// Enable with: RUN_UI_CALENDAR=1 npx playwright test e2e/lead-time.spec.ts
const RUN_UI = process.env.RUN_UI_CALENDAR === "1";
test.skip(
  !RUN_UI,
  "UI calendar test disabled by default; enable with RUN_UI_CALENDAR=1"
);

// ----- Config -----
const APP_URL =
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://127.0.0.1:3000"; // if using netlify dev, set to 8888

const HEAVY_MACHINE_PATH = process.env.TEST_HEAVY_MACHINE_PATH || "/machine/7";

// ----- Helpers using stable test hooks -----
async function openCalendar(page: Page): Promise<Locator> {
  // Click the known trigger test id (added in components/date-picker.tsx)
  await page.getByTestId("date-range-trigger").click();
  // Wait for the calendar root test id (added in components/date-picker.tsx)
  const calendarRoot = page.getByTestId("booking-calendar");
  await expect(calendarRoot).toBeVisible();
  return calendarRoot;
}

// Build robust labels for a YMD (Lisbon TZ) to match react-day-picker ARIA
function labelsForYmdLisbon(ymd: string): string[] {
  const { y, m, d } = parseYmd(ymd);
  const dt = new Date(Date.UTC(y, m - 1, d));

  const us = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Lisbon",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(dt); // "September 13, 2025"

  const gb = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Lisbon",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(dt); // "13 September 2025"

  const ptFull = new Intl.DateTimeFormat("pt-PT", {
    timeZone: "Europe/Lisbon",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(dt); // "sábado, 13 de setembro de 2025"

  const ptNoWeekday = ptFull.replace(/^[^,]*,\s*/, ""); // "13 de setembro de 2025"

  const ptSimple = new Intl.DateTimeFormat("pt-PT", {
    timeZone: "Europe/Lisbon",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(dt);

  return [us, gb, ptFull, ptNoWeekday, ptSimple];
}

async function getCalendarCellByYmd(
  calendarRoot: Locator,
  ymd: string
): Promise<Locator | null> {
  for (const name of labelsForYmdLisbon(ymd)) {
    const byRole = calendarRoot.getByRole("button", { name }).first();
    if (await byRole.count()) return byRole;

    const byLabel = calendarRoot.getByLabel(name).first();
    if (await byLabel.count()) return byLabel;
  }

  // Fallback: numeric day in the visible months
  const { d } = parseYmd(ymd);
  const numeric = calendarRoot
    .getByRole("button", { name: new RegExp(`^${d}$`) })
    .first();
  if (await numeric.count()) return numeric;

  return null;
}

// ----- Test -----
test.describe("Heavy-machine lead time (2 days) with 15:00 Lisbon cutoff — UI", () => {
  test("pre-earliest disabled; earliest enabled (calendar popover)", async ({
    page,
  }) => {
    const earliest = computeEarliestStartYmd(new Date(), 2, 15);
    const preEarliest = addDaysYmd(earliest, -1);

    await page.goto(`${APP_URL}${HEAVY_MACHINE_PATH}`, {
      waitUntil: "networkidle",
    });

    const calendarRoot = await openCalendar(page);

    const preCell = await getCalendarCellByYmd(calendarRoot, preEarliest);
    expect
      .soft(preCell, `Missing pre-earliest cell ${preEarliest}`)
      .toBeTruthy();
    if (preCell) {
      await expect
        .soft(preCell, `Expected ${preEarliest} to be disabled`)
        .toHaveAttribute("aria-disabled", /true/i);
    }

    const earliestCell = await getCalendarCellByYmd(calendarRoot, earliest);
    expect.soft(earliestCell, `Missing earliest cell ${earliest}`).toBeTruthy();
    if (earliestCell) {
      const attr = await earliestCell.getAttribute("aria-disabled");
      expect
        .soft(
          attr === null || String(attr).toLowerCase() !== "true",
          `Expected ${earliest} enabled`
        )
        .toBe(true);
    }
  });
});
