// tests/helpers/stripe-3ds.ts — fix popup/redirect handling + TS types
import { Page, Frame, Locator } from "@playwright/test";

export async function complete3DSChallenge(
  page: Page,
  opts?: { timeoutMs?: number; debug?: boolean }
) {
  const timeoutMs = opts?.timeoutMs ?? 60_000;
  const debug = opts?.debug ?? false;
  const deadline = Date.now() + timeoutMs;
  const log = (m: string) => { if (debug) console.info(`[3DS] ${m}`); };
  const isChallengeUrl = (u: string) => /3d[_-]?secure|challenge|acs|authenticate/i.test(u);

  // ── 1) Prefer page-based challenge (popup or same-page redirect)
  const popupPromise = page.context()
    .waitForEvent("page", { timeout: 8000 })                           // ✅ only 2 args
    .then((p: Page) => (isChallengeUrl(p.url()) ? p : null))
    .catch(() => null);

  const navPromise = page
    .waitForURL((url: URL) => isChallengeUrl(url.toString()), { timeout: 8000 }) // ✅ URL predicate
    .then((): Page => page)
    .catch(() => null);

  const targetPage = (await Promise.race([popupPromise, navPromise])) as Page | null;
  if (targetPage) {
    await actOnChallengeSurface(targetPage);
    await waitForReturn(page, deadline - Date.now());
    return;
  }

  // ── 2) Fallback: iframe-based challenge on the current page
  while (Date.now() < deadline) {
    for (const f of page.frames()) {
      const url = safe(() => f.url()) ?? "";
      const name = safe(() => f.name()) ?? "";
      const looksIssuer =
        /3d[_-]?secure|challenge|acs|authenticate/i.test(url) ||
        /__privateStripeFrame|challenge/i.test(name);
      if (!looksIssuer) continue;

      if (await tryCompleteInTarget(f)) {
        await waitForReturn(page, deadline - Date.now());
        return;
      }
    }
    await page.waitForTimeout(300);
  }

  throw new Error("Could not complete 3DS challenge automatically");

  // ── internals (tiny, SRP) ────────────────────────────────────────────────
  async function actOnChallengeSurface(target: Page | Frame) {
    // Single action button
    const single = target.getByRole("button", { name: buttonRegex }).first();
    if (await isVisible(single)) { await single.click(); return; }

    // Radio “Complete” + submit
    const radio = target.getByRole("radio", { name: /complete/i }).first()
      .or(target.locator('label:has-text("Complete"), input[type="radio"]').first());
    if (await isVisible(radio)) {
      await radio.click().catch(() => {});
      const submit = target.getByRole("button", { name: submitRegex }).first()
        .or(target.locator('input[type="submit"]').first());
      if (await isVisible(submit)) { await submit.click(); return; }
    }

    // OTP variant
    const otp = target.getByRole("textbox", { name: /code|one[-\s]?time|otp/i }).first()
      .or(target.locator('input[autocomplete="one-time-code"], input[name*="code"], input[type="tel"]').first());
    if (await isVisible(otp)) {
      await otp.fill("1234");
      const submit = target.getByRole("button", { name: submitRegex }).first()
        .or(target.locator('input[type="submit"]').first());
      if (await isVisible(submit)) { await submit.click(); return; }
    }

    // Legacy test button
    const legacy = target.locator("#test-source-authorize-3ds").first();
    if (await isVisible(legacy)) { await legacy.click(); return; }

    // Last resort: brief wait and retry once
    await target.waitForTimeout(500);
    await actOnChallengeSurface(target);
  }

  async function tryCompleteInTarget(target: Page | Frame) {
    const btn = target.getByRole("button", { name: buttonRegex }).first();
    if (await isVisible(btn)) { await btn.click(); return true; }

    const otp = target.getByRole("textbox", { name: /code|one[-\s]?time|otp/i }).first()
      .or(target.locator('input[autocomplete="one-time-code"], input[name*="code"], input[type="tel"]').first());
    if (await isVisible(otp)) {
      await otp.fill("1234");
      const submit = target.getByRole("button", { name: submitRegex }).first()
        .or(target.locator('input[type="submit"]').first());
      if (await isVisible(submit)) { await submit.click(); return true; }
    }

    const legacy = target.locator("#test-source-authorize-3ds").first();
    if (await isVisible(legacy)) { await legacy.click(); return true; }
    return false;
  }

  function safe<T>(fn: () => T): T | null { try { return fn(); } catch { return null; } }
  async function isVisible(locator: Locator) { try { return await locator.isVisible({ timeout: 800 }); } catch { return false; } }
  async function waitForReturn(p: Page, ms: number) {
    const t = Math.max(2000, ms);
    await p.waitForLoadState("domcontentloaded", { timeout: t }).catch(() => {});
    await p.waitForLoadState("networkidle", { timeout: t }).catch(() => {});
    await p.waitForURL(/\/booking\/success|success|return_url=|session_id=/, { timeout: t }).catch(() => {});
  }
}

const buttonRegex = /Complete authentication|Complete|Authorize|Authenticate|Approve|Finish|Submit|Continue|Confirm/i;
const submitRegex = /submit|continue|verify|confirm|authorize/i;
