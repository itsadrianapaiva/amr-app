import { test, expect, Page, Locator } from "@playwright/test";
import { complete3DSChallenge } from "../tests/helpers/stripe-3ds";

/* ------------------------- Tunables for stability ------------------------- */
const FUTURE_DAYS_OFFSET = 60; // keep far from "today" and heavy-truck cutoff logic
const RENTAL_LENGTH_DAYS = 2;
const CARD_3DS_NUMBER = process.env.STRIPE_TEST_CARD_3DS ?? "4000000000003220";
const CARD_EXP = process.env.STRIPE_TEST_CARD_EXP ?? "12/34";
const CARD_CVC = process.env.STRIPE_TEST_CARD_CVC ?? "123";
const OVERRIDE_TOTAL_EUROS = 123.45; // small fixed total for predictable Checkout

/* ---------------------------------- Test ---------------------------------- */
test.describe("Card 3DS browser challenge (real Checkout)", () => {
  test("user completes 3DS in Checkout and returns to success page", async ({ page, baseURL, request }) => {
    test.setTimeout(120_000); // calendar-free flow, but Stripe+3DS can be slow in CI

    // 1) Create a PENDING booking via dev helper (no UI involved)
    const { bookingId, startDate, endDate, machineId } = await createBookingWithRetry(request, baseURL);

    // 2) Mint a real Stripe Checkout Session for that booking (dev-only route)
    const checkoutUrl = await createCheckoutForBooking(request, baseURL, bookingId, OVERRIDE_TOTAL_EUROS);

    // 3) Drive Stripe Checkout (Card) → enter a 3DS-required card → complete challenge
    await page.goto(checkoutUrl, { waitUntil: "domcontentloaded" });
    await selectCardTabIfPresent(page); // MB WAY/IBAN may also be enabled

    await fillStripeCardOnCheckout(page, {
      number: CARD_3DS_NUMBER,
      exp: CARD_EXP,
      cvc: CARD_CVC,
      name: "E2E Test",
    });

    await clickFirst(page, [/pay|pagar|confirm/i]);
    await complete3DSChallenge(page, { timeoutMs: 60_000 });

    // 4) Land on our success page and sanity-check content
    await page.waitForURL(/\/booking\/success|success|return_url=/, { timeout: 60_000 });
    await expect(page).toHaveURL(/success/);
    await expect(page.getByText(/booking|payment|success/i).first()).toBeVisible();

    // 5) Extract Booking ID from UI and assert DB promotion via inspect endpoint
    const idText = await page.getByText(/booking id/i).first().textContent();
    const parsedId = Number(String(idText ?? "").replace(/\D+/g, ""));
    const id = Number.isFinite(parsedId) && parsedId > 0 ? parsedId : bookingId; // fallback to known id

    let status = "PENDING";
    let depositPaid = false;
    let stripePaymentIntentId: string | null = null;
    let holdExpiresAt: string | null = "non-null";

    for (let i = 0; i < 16; i++) {
      const res = await request.get(`${baseURL}/api/dev/inspect-booking?id=${id}`, {
        headers: { "cache-control": "no-store" },
      });
      expect(res.ok()).toBeTruthy();
      const json = JSON.parse(await res.text());
      status = json?.status ?? status;
      depositPaid = json?.depositPaid ?? depositPaid;
      stripePaymentIntentId = json?.stripePaymentIntentId ?? stripePaymentIntentId;
      if (Object.prototype.hasOwnProperty.call(json, "holdExpiresAt")) {
        holdExpiresAt = json.holdExpiresAt;
      }
      if (status === "CONFIRMED" && depositPaid && stripePaymentIntentId) break;
      await page.waitForTimeout(350);
    }

    expect(status).toBe("CONFIRMED");
    expect(depositPaid).toBe(true);
    expect(stripePaymentIntentId).toBeTruthy();
    expect(holdExpiresAt).toBeNull();
  });
});

/* --------------------------- Helpers (small & focused) --------------------------- */

// Create a PENDING booking using the existing dev route, retrying on overlap.
async function createBookingWithRetry(request: import("@playwright/test").APIRequestContext, baseURL?: string) {
  const base = new Date();
  const machineId = 1;
  for (let attempt = 0; attempt < 5; attempt++) {
    const start = addDays(base, FUTURE_DAYS_OFFSET + attempt * 7);
    const end = addDays(start, RENTAL_LENGTH_DAYS);
    const startDate = isoDay(start);
    const endDate = isoDay(end);

    const res = await request.post(`${baseURL}/api/dev/create-booking`, {
      headers: { "content-type": "application/json" },
      data: JSON.stringify({
        machineId,
        startDate,
        endDate,
        name: "E2E User (3DS browser)",
        email: "e2e-3ds-browser@example.com",
        phone: "+351000000000",
        totalEuros: OVERRIDE_TOTAL_EUROS,
      }),
    });
    const text = await res.text();
    if (res.ok()) {
      const json = JSON.parse(text);
      return {
        bookingId: json.bookingId as number,
        startDate,
        endDate,
        machineId,
      };
    }
    if (res.status() === 400 && text.includes("Selected dates are no longer available")) continue;
    throw new Error(`create-booking failed: HTTP ${res.status()} — ${text}`);
  }
  throw new Error("create-booking failed after retries due to overlapping dates.");
}

// Ask dev route to create a real Checkout Session for our booking; return its URL.
async function createCheckoutForBooking(
  request: import("@playwright/test").APIRequestContext,
  baseURL: string | undefined,
  bookingId: number,
  totalEuros?: number
): Promise<string> {
  const res = await request.post(`${baseURL}/api/dev/checkout-for-booking`, {
    headers: { "content-type": "application/json" },
    data: JSON.stringify({ bookingId, totalEuros }),
  });
  const txt = await res.text();
  if (!res.ok()) throw new Error(`checkout-for-booking failed: HTTP ${res.status()} — ${txt}`);
  const json = JSON.parse(txt);
  if (!json?.url) throw new Error(`checkout-for-booking did not return a URL: ${txt}`);
  return json.url as string;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

/* ---------------------------- Stripe page helpers ---------------------------- */

async function clickFirst(page: Page, names: RegExp[]) {
  for (const rx of names) {
    const btn = page.getByRole("button", { name: rx }).first();
    if (await isVisible(btn)) { await btn.click(); return; }
    const link = page.getByRole("link", { name: rx }).first();
    if (await isVisible(link)) { await link.click(); return; }
  }
  throw new Error("Expected CTA not found");
}

async function selectCardTabIfPresent(page: Page) {
  const tab = page.getByRole("tab", { name: /card|cart[aã]o/i }).first();
  if (await isVisible(tab)) { await tab.click().catch(() => {}); return; }
  const btn = page.getByRole("button", { name: /card|cart[aã]o/i }).first();
  if (await isVisible(btn)) await btn.click().catch(() => {});
}

async function fillStripeCardOnCheckout(
  page: Page,
  opts: { number: string; exp: string; cvc: string; name?: string }
) {
  if (opts.name) {
    const nameField = page.getByLabel(/name on card|cardholder|card holder|nome/i).first()
      .or(page.locator('input[name="name"]').first());
    if (await isVisible(nameField)) await nameField.fill(opts.name);
  }

  async function fillInStripeFrame(selector: string, value: string) {
    for (const f of page.frames()) {
      const el = f.locator(selector).first();
      if (await isVisible(el)) { await el.fill(value); return true; }
    }
    return false;
  }

  const okNum = await fillInStripeFrame('input[name="number"], input[autocomplete="cc-number"]', opts.number);
  const okExp = await fillInStripeFrame('input[name="exp-date"], input[autocomplete="cc-exp"]', opts.exp);
  const okCvc = await fillInStripeFrame('input[name="cvc"], input[autocomplete="cc-csc"]', opts.cvc);

  if (!okNum || !okExp || !okCvc) {
    throw new Error("Could not locate Stripe card fields in Checkout (number/exp/cvc)");
  }
}

async function isVisible(locator: Locator): Promise<boolean> {
  try { return await locator.isVisible({ timeout: 2000 }); } catch { return false; }
}
