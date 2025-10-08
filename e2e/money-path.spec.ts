// e2e/money-path.spec.ts
import { test, expect, Page, Locator } from "@playwright/test";

/**
 * Assumptions kept loose on purpose:
 * - Home has a list of machines; each card links to a detail page.
 * - Detail page lets you pick dates and proceed to checkout.
 * - Checkout uses Stripe Hosted Checkout (pay.stripe.com / checkout.stripe.com).
 * - Success page lives at /success and renders a confirmation plus (optionally) an invoice link.
 *
 * Notes:
 * - This test runs with Stripe test keys. It uses the standard 4242… card.
 * - We avoid brittle selectors by using roles and common texts.
 * - Helpers are ≤ 100 lines to respect your guardrails.
 */

test.describe("Money path — browse to paid booking", () => {
  test("Home → Machine → Dates → Stripe pay → Success", async ({ page, context, baseURL }) => {
    // 1) Home loads and shows machine cards
    await page.goto("/");
    await expect(page).toHaveTitle(/AMR|Machinery|Rentals/i);

    // Click the first visible machine card link (robust by role)
    const machineLink = page
      .getByRole("link", { name: /(view|details|rent|book)/i })
      .first();
    await machineLink.click();

    // 2) On the machine page, select dates
    await selectDatesIfPresent(page);

    // 3) Proceed to checkout (button copy may vary)
    await clickFirst(page, [
      { role: "button", name: /(checkout|rent now|book now|continue)/i },
      { role: "link", name: /(checkout|rent now|book now|continue)/i },
    ]);

    // 4) Expect Stripe Hosted Checkout; complete test payment
    await completeStripeHostedCheckout(context);

    // 5) Back on app success page
    // Allow for Netlify/Next redirects after Stripe returns
    await page.waitForURL("**/success**", { timeout: 30_000 });
    await expect(page).toHaveURL(/\/success/i);

    // Confirm user-facing success cues
    await expect(
      page.getByText(/booking confirmed|thank you|payment received/i).first()
    ).toBeVisible();

    // Optional: invoice link presence (signed proxy). Skip if not yet issued.
    const invoiceLink = page.getByRole("link", { name: /invoice|fatura|pdf/i });
    if (await invoiceLink.count()) {
      await expect(invoiceLink.first()).toBeVisible();
    }
  });
});

/* ---------------------------- Helpers (small) ---------------------------- */

/** Click the first available target from a list of role+name pairs. */
async function clickFirst(page: Page, targets: { role: "button" | "link"; name: RegExp }[]) {
  for (const t of targets) {
    const locator =
      t.role === "button"
        ? page.getByRole("button", { name: t.name }).first()
        : page.getByRole("link", { name: t.name }).first();
    if (await locator.count()) {
      await locator.click();
      return;
    }
  }
  throw new Error("No actionable checkout trigger found");
}

/**
 * Pick a short date range in common date pickers.
 * Tries to click inputs by label, then uses role fallbacks.
 * If no picker exists (preselected dates), it no-ops safely.
 */
async function selectDatesIfPresent(page: Page) {
  // Try common labels
  const from = page.getByLabel(/start date|from|pickup|inicio|início/i).first();
  const to = page.getByLabel(/end date|to|return|fim/i).first();

  const hasFrom = await from.count();
  const hasTo = await to.count();

  if (hasFrom && hasTo) {
    await from.click();
    await pickCalendarDay(page, 1); // tomorrow
    await to.click();
    await pickCalendarDay(page, 3); // +2 nights
  } else {
    // Fallback: generic date inputs
    const dateInputs = page.locator('input[type="date"]');
    if ((await dateInputs.count()) >= 2) {
      const today = new Date();
      const d1 = isoDate(addDays(today, 1));
      const d2 = isoDate(addDays(today, 3));
      await dateInputs.nth(0).fill(d1);
      await dateInputs.nth(1).fill(d2);
    }
  }

  // Apply or continue if an explicit button exists
  const apply = page.getByRole("button", { name: /(apply|done|continue|confirm)/i }).first();
  if (await apply.count()) {
    await apply.click();
  }
}

/** Clicks a day cell in common calendar widgets, offset from today. */
async function pickCalendarDay(page: Page, offsetDays: number) {
  const target = addDays(new Date(), offsetDays).getDate();
  // Many calendars render days as buttons with the day number as accessible name
  const dayBtn = page.getByRole("button", { name: new RegExp(`^${target}$`) }).first();
  if (await dayBtn.count()) {
    await dayBtn.click();
  } else {
    // Fallback: any gridcell with that number
    const cell = page.getByRole("gridcell", { name: new RegExp(`^${target}$`) }).first();
    if (await cell.count()) {
      await cell.click();
    }
  }
}

/** Complete Stripe Hosted Checkout with standard 4242 test card. */
async function completeStripeHostedCheckout(context: import("@playwright/test").BrowserContext) {
  // Wait for navigation to Stripe (either domain)
  const stripePage = await waitForStripeCheckoutPage(context);

  // Email (top field). Use a unique-ish email per run.
  await stripePage.getByLabel(/email/i).fill(`test+e2e-${Date.now()}@amr-rentals.test`);

  // Card fields inside iframes
  await fillStripeCardElements(stripePage, {
    number: "4242 4242 4242 4242",
    expiry: "12 / 34",
    cvc: "123",
    name: "Playwright Test",
    zip: "12345",
  });

  // Pay button can be "Pay" or "Subscribe" depending on mode; match "Pay"
  const payButton = stripePage.getByRole("button", { name: /pay/i });
  await expect(payButton).toBeEnabled();
  await payButton.click();
}

/** Wait for the Stripe checkout tab and return it. */
async function waitForStripeCheckoutPage(context: import("@playwright/test").BrowserContext) {
  const page = await context.waitForEvent("page", {
    predicate: (p) =>
      /stripe\.com/.test(p.url()) || /pay\.stripe\.com/.test(p.url()),
    timeout: 30_000,
  });
  await page.waitForLoadState("domcontentloaded");
  return page;
}

/** Fill Stripe's card iframes in Hosted Checkout. */
async function fillStripeCardElements(stripePage: Page, data: {
  number: string; expiry: string; cvc: string; name: string; zip?: string;
}) {
  // Card number
  await frameFill(stripePage, 'iframe[name="cardNumber"], iframe[title*="card number"]', 'input[name="cardnumber"], input[autocomplete="cc-number"]', data.number);
  // Expiry
  await frameFill(stripePage, 'iframe[name="cardExpiry"], iframe[title*="expiration"]', 'input[name="exp-date"], input[autocomplete="cc-exp"]', data.expiry);
  // CVC
  await frameFill(stripePage, 'iframe[name="cardCvc"], iframe[title*="CVC"]', 'input[name="cvc"], input[autocomplete="cc-csc"]', data.cvc);

  // Name and postal live outside the iframes on Hosted Checkout
  await stripePage.getByLabel(/name on card|name/i).first().fill(data.name);
  const zipField = stripePage.getByLabel(/zip|postal/i).first();
  if (await zipField.count()) await zipField.fill(data.zip || "00000");
}

/** Helper to fill an input inside a specific iframe, robust to different attrs. */
async function frameFill(page: Page, iframeSelector: string, inputSelector: string, value: string) {
  const frameLocator = page.frameLocator(iframeSelector).first();
  await frameLocator.locator(inputSelector).fill(value);
}

/* ---------------------------- Tiny date utils --------------------------- */
function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}
function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
