import { test, expect, Page, Locator } from "@playwright/test";
import { addDaysYmd, computeEarliestStartYmd, parseYmd } from "./utils/dates";

// Skip this UI-spec unless explicitly enabled.
// Enable by running: RUN_UI_CALENDAR=1 npx playwright test e2e/lead-time.spec.ts
const RUN_UI = process.env.RUN_UI_CALENDAR === "1";
test.skip(
  !RUN_UI,
  "UI calendar test disabled by default; enable with RUN_UI_CALENDAR=1"
);

// ----- Config -----
const APP_URL =
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://127.0.0.1:3000"; // use your Next dev by default

const HEAVY_MACHINE_PATH = process.env.TEST_HEAVY_MACHINE_PATH || "/machine/7";

// ----- Helpers: open calendar popover -----
async function openCalendarPopover(page: Page): Promise<void> {
  // 1) Prefer a stable test id if present
  const byTestId = page.getByTestId("date-range-trigger");
  if (await byTestId.count()) {
    await byTestId.click();
    await waitForCalendar(page);
    return;
  }

  // 2) Try localized button names commonly used on date triggers
  const namePattern =
    /(datas?|data|dates?|calendar|calendário|selecionar|escolher|pick|choose)/i;

  const byName = page.getByRole("button", { name: namePattern }).first();
  if (await byName.count()) {
    await byName.click();
    await waitForCalendar(page);
    return;
  }

  // 3) Generic popover/dialog trigger
  const byHasPopup = page.locator('[aria-haspopup="dialog"]').first();
  if (await byHasPopup.count()) {
    await byHasPopup.click();
    await waitForCalendar(page);
    return;
  }

  // 4) As a last resort, click the first button and hope it’s the trigger (fails softly)
  const anyBtn = page.getByRole("button").first();
  if (await anyBtn.count()) {
    await anyBtn.click().catch(() => {});
    await waitForCalendar(page);
  }
}

async function waitForCalendar(page: Page): Promise<void> {
  // react-day-picker root usually renders [data-rdp]; shadcn Popover wraps with a dialog/popup
  await page
    .waitForSelector(
      '[data-rdp], [role="dialog"] [data-rdp], [data-radix-popper-content-wrapper] [data-rdp]',
      { timeout: 5000 }
    )
    .catch(() => {});
}

// Build a robust list of accessible labels for a YMD in Lisbon TZ
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

// Query a date cell INSIDE the calendar popover
async function getCalendarCellByYmd(
  page: Page,
  ymd: string
): Promise<Locator | null> {
  const calendarRoot = page
    .locator(
      '[data-rdp], [role="dialog"] [data-rdp], [data-radix-popper-content-wrapper] [data-rdp]'
    )
    .first();

  // Ensure the calendar exists before searching within it
  if (!(await calendarRoot.count())) return null;

  for (const name of labelsForYmdLisbon(ymd)) {
    const byRole = calendarRoot.getByRole("button", { name }).first();
    if (await byRole.count()) return byRole;

    const byLabel = calendarRoot.getByLabel(name).first();
    if (await byLabel.count()) return byLabel;
  }

  // Fallback: numeric day (scoped to calendar root)
  const { d } = parseYmd(ymd);
  const numeric = calendarRoot
    .getByRole("button", { name: new RegExp(`^${d}$`) })
    .first();
  if (await numeric.count()) return numeric;

  return null;
}

test.describe("Heavy-machine lead time (2 days) with 15:00 Lisbon cutoff", () => {
  test("dates before earliest are disabled; earliest is enabled", async ({
    page,
  }) => {
    const earliest = computeEarliestStartYmd(new Date(), 2, 15);
    const preEarliest = addDaysYmd(earliest, -1);

    await page.goto(`${APP_URL}${HEAVY_MACHINE_PATH}`, {
      waitUntil: "networkidle",
    });

    // OPEN the shadcn popover calendar first
    await openCalendarPopover(page);

    // Now query INSIDE the day-picker
    const preCell = await getCalendarCellByYmd(page, preEarliest);
    expect
      .soft(
        preCell,
        `Could not find pre-earliest date cell (${preEarliest}). Make sure the calendar popover is open.`
      )
      .toBeTruthy();

    if (preCell) {
      await expect
        .soft(
          preCell,
          `Expected ${preEarliest} to be disabled due to 2-day lead time.`
        )
        .toHaveAttribute("aria-disabled", /true/i);
    }

    const earliestCell = await getCalendarCellByYmd(page, earliest);
    expect
      .soft(earliestCell, `Could not find earliest date cell (${earliest}).`)
      .toBeTruthy();

    if (earliestCell) {
      const attr = await earliestCell.getAttribute("aria-disabled");
      expect
        .soft(
          attr === null || String(attr).toLowerCase() !== "true",
          `Expected ${earliest} to be enabled/selectable.`
        )
        .toBe(true);
    }
  });
});
