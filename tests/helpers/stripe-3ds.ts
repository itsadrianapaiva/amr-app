// tests/helpers/stripe-3ds.ts
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

  // 1) First, wait for either a popup page or a same-page redirect to a challenge URL.
  const popupPromise = page.context()
    .waitForEvent("page", p => isChallengeUrl(p.url()), { timeout: 8000 })
    .catch(() => null);
  const navPromise = page.waitForURL(isChallengeUrl, { timeout: 8000 })
    .then(() => page)
    .catch(() => null);

  let targetPage: Page | null = await Promise.race([popupPromise, navPromise]) as Page | null;

  // 2) If we got a page-based challenge, act on it.
  if (targetPage) {
    log(`challenge page detected: ${targetPage.url()}`);
    await actOnChallengeSurface(targetPage, deadline, log);
    await waitForReturn(page, deadline - Date.now(), log);
    return;
  }

  // 3) Otherwise, poll frames on the original page (iframe-based challenge).
  while (Date.now() < deadline) {
    for (const f of page.frames()) {
      const url = safe(() => f.url()) ?? "";
      const name = safe(() => f.name()) ?? "";
      const looksIssuer =
        /3d[_-]?secure|challenge|acs|authenticate/i.test(url) ||
        /__privateStripeFrame|challenge/i.test(name);
      if (!looksIssuer) continue;

      log(`iframe challenge detected: name="${name}" url="${url}"`);
      const handled = await tryCompleteInTarget(f, log);
      if (handled) {
        await waitForReturn(page, deadline - Date.now(), log);
        return;
      }
    }
    await page.waitForTimeout(300);
  }

  throw new Error("Could not complete 3DS challenge automatically");

  // ── internals ──────────────────────────────────────────────────────────────
  async function actOnChallengeSurface(target: Page | Frame, until: number, dbg: (m: string) => void) {
    // Single action button
    const single = target.getByRole("button", { name: buttonRegex }).first();
    if (await isVisible(single)) { dbg("single action"); await single.click(); return; }

    // Radio “Complete” + submit
    const radio = target.getByRole("radio", { name: /complete/i }).first()
      .or(target.locator('label:has-text("Complete"), input[type="radio"]').first());
    if (await isVisible(radio)) {
      dbg("radio complete");
      await radio.click().catch(() => {});
      const submit = target.getByRole("button", { name: submitRegex }).first()
        .or(target.locator('input[type="submit"]').first());
      if (await isVisible(submit)) { await submit.click(); return; }
    }

    // OTP variant
    const otp = target.getByRole("textbox", { name: /code|one[-\s]?time|otp/i }).first()
      .or(target.locator('input[autocomplete="one-time-code"], input[name*="code"], input[type="tel"]').first());
    if (await isVisible(otp)) {
      dbg("otp");
      await otp.fill("1234");
      const submit = target.getByRole("button", { name: submitRegex }).first()
        .or(target.locator('input[type="submit"]').first());
      if (await isVisible(submit)) { await submit.click(); return; }
    }

    // Legacy test button
    const legacy = target.locator("#test-source-authorize-3ds").first();
    if (await isVisible(legacy)) { dbg("legacy"); await legacy.click(); return; }

    // If nothing matched on a page popup, give the iframe path a chance.
    if ("frames" in target && typeof (target as any).frames === "function") {
      for (const f of (target as any as Page).frames()) {
        if (await tryCompleteInTarget(f, dbg)) return;
      }
    }
    // As a last resort, wait briefly for any of the above to appear.
    await target.waitForTimeout(500);
    if (Date.now() < until) await actOnChallengeSurface(target, until, dbg);
  }

  async function tryCompleteInTarget(target: Page | Frame, dbg: (m: string) => void) {
    const btn = target.getByRole("button", { name: buttonRegex }).first();
    if (await isVisible(btn)) { dbg("iframe/button"); await btn.click(); return true; }

    const otp = target.getByRole("textbox", { name: /code|one[-\s]?time|otp/i }).first()
      .or(target.locator('input[autocomplete="one-time-code"], input[name*="code"], input[type="tel"]').first());
    if (await isVisible(otp)) {
      dbg("iframe/otp");
      await otp.fill("1234");
      const submit = target.getByRole("button", { name: submitRegex }).first()
        .or(target.locator('input[type="submit"]').first());
      if (await isVisible(submit)) { await submit.click(); return true; }
    }

    const legacy = target.locator("#test-source-authorize-3ds").first();
    if (await isVisible(legacy)) { dbg("iframe/legacy"); await legacy.click(); return true; }
    return false;
  }

  function safe<T>(fn: () => T): T | null { try { return fn(); } catch { return null; } }
  async function isVisible(locator: Locator) { try { return await locator.isVisible({ timeout: 800 }); } catch { return false; } }
  async function waitForReturn(p: Page, remainingMs: number, dbg: (m: string) => void) {
    const ms = Math.max(2000, remainingMs);
    await p.waitForLoadState("domcontentloaded", { timeout: ms }).catch(() => {});
    await p.waitForLoadState("networkidle", { timeout: ms }).catch(() => {});
    await p.waitForURL(/\/booking\/success|success|return_url=|session_id=/, { timeout: ms }).catch(() => {});
    dbg("returned");
  }
}

const buttonRegex = /Complete authentication|Complete|Authorize|Authenticate|Approve|Finish|Submit|Continue|Confirm/i;
const submitRegex = /submit|continue|verify|confirm|authorize/i;
