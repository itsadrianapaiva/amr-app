// e2e/lead-time.spec.ts
import { test, expect, Page, Locator } from "@playwright/test";
import { addDaysYmd, computeEarliestStartYmd } from "./utils/dates";

// Gate this UI test behind an env flag.
// Enable with: RUN_UI_CALENDAR=1 npx playwright test e2e/lead-time.spec.ts
const RUN_UI = process.env.RUN_UI_CALENDAR === "1";
test.skip(!RUN_UI, "UI calendar test disabled by default; enable with RUN_UI_CALENDAR=1");

// ---- Config ----
const APP_URL =
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://127.0.0.1:3000";

const HEAVY_MACHINE_PATH =
  process.env.TEST_HEAVY_MACHINE_PATH || "/machine/7";

// ---- Helpers (stable test hooks + ISO aria-label) ----
async function openCalendar(page: Page): Promise<Locator> {
  await page.goto(`${APP_URL}${HEAVY_MACHINE_PATH}`, { waitUntil: "networkidle" });
  await page.getByTestId("date-range-trigger").click();
  const root = page.getByTestId("booking-calendar");
  await expect(root).toBeVisible();
  return root;
}

/** react-day-picker (via our formatters) sets aria-label="YYYY-MM-DD" on each day button */
async function findDayByYmd(root: Locator, ymd: string): Promise<Locator | null> {
  const btn = root.locator(`button[aria-label="${ymd}"]`).first();
  return (await btn.count()) ? btn : null;
}

/** Click the calendar's "next month" (supports EN/PT accessible names) */
async function clickNextMonth(root: Locator) {
  const next = root.getByRole("button", {
    name: /(go to next month|next month|próximo mês)/i,
  }).first();
  if (await next.count()) await next.click();
}

/** Page forward until the requested day is visible (up to 6 months) */
async function ensureDayVisible(root: Locator, ymd: string): Promise<Locator | null> {
  let btn = await findDayByYmd(root, ymd);
  for (let i = 0; !btn && i < 6; i++) {
    await clickNextMonth(root);
    btn = await findDayByYmd(root, ymd);
  }
  return btn;
}

test.describe("Heavy-machine lead time (2 days) with 15:00 Lisbon cutoff — UI", () => {
  test("pre-earliest disabled; earliest enabled (calendar popover)", async ({ page }) => {
    const earliest = computeEarliestStartYmd(new Date(), 2, 15);
    const preEarliest = addDaysYmd(earliest, -1);

    const calendar = await openCalendar(page);

    const preCell = await ensureDayVisible(calendar, preEarliest);
    expect.soft(preCell, `Missing pre-earliest cell ${preEarliest}`).toBeTruthy();
    if (!preCell) {
      // Attach calendar HTML for debugging when missing
      await test.info().attach("calendar-html", {
        body: await calendar.innerHTML(),
        contentType: "text/html",
      });
    } else {
      await expect
        .soft(preCell, `Expected ${preEarliest} to be disabled`)
        .toHaveAttribute("aria-disabled", /true/i);
    }

    const earliestCell = await ensureDayVisible(calendar, earliest);
    expect.soft(earliestCell, `Missing earliest cell ${earliest}`).toBeTruthy();
    if (!earliestCell) {
      await test.info().attach("calendar-html-earliest", {
        body: await calendar.innerHTML(),
        contentType: "text/html",
      });
    } else {
      const attr = await earliestCell.getAttribute("aria-disabled");
      expect
        .soft(attr === null || String(attr).toLowerCase() !== "true", `Expected ${earliest} enabled`)
        .toBe(true);
    }
  });
});
