import { Page, Frame } from "@playwright/test";

/**
 * Attempts to complete a Stripe 3DS v2 challenge inside the issuer iframe.
 * Works for Stripe Checkout flows where a modal or embedded frame appears.
 *
 * Usage:
 *   await complete3DSChallenge(page);
 *
 * Strategy:
 * 1) Wait for a new iframe that looks like an ACS/3DS challenge frame.
 * 2) Try a small set of common button labels: "Complete authentication", "Authorize", "Submit", "Continue".
 * 3) If an OTP field is present, fill a generic code and submit.
 */
export async function complete3DSChallenge(page: Page, timeoutMs = 15000) {
  // Helper: best-effort find of candidate frames
  function candidate(frame: Frame) {
    const t = (frame as any).name?.() || "";
    const u = frame.url?.() || "";
    const okTitle =
      /3ds|challenge|authentication|acs|secure/i.test(t) ||
      /3ds|challenge|authentication|acs|secure/i.test(u);
    return okTitle;
  }

  const deadline = Date.now() + timeoutMs;
  let chosen: Frame | null = null;

  // Poll for a matching frame
  while (Date.now() < deadline && !chosen) {
    for (const f of page.frames()) {
      if (candidate(f)) {
        chosen = f;
        break;
      }
    }
    if (!chosen) await page.waitForTimeout(250);
  }

  if (!chosen) {
    // As a fallback, pick any private Stripe frame (Checkout often uses these)
    chosen =
      page
        .frames()
        .find((f) => /__privateStripeFrame/i.test((f as any).name?.() || "")) ||
      null;
  }

  if (!chosen) {
    throw new Error("3DS challenge frame not found");
  }

  // Try common buttons
  const buttonLabels = [
    /complete/i,
    /authorize/i,
    /submit/i,
    /continue/i,
    /approve/i,
    /confirm/i,
  ];

  for (const label of buttonLabels) {
    const btn = await chosen.getByRole("button", { name: label }).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      // Small pause to let the redirect back to Checkout occur
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
      return;
    }
  }

  // OTP fallback
  const otp = await chosen.getByRole("textbox").first();
  if (await otp.isVisible().catch(() => false)) {
    await otp.fill("1234");
    const submit =
      (await chosen.getByRole("button", { name: /submit|continue|verify/i }).first()) ||
      (await chosen.locator('input[type="submit"]').first());
    if (await submit.isVisible().catch(() => false)) {
      await submit.click();
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
      return;
    }
  }

  // If we reach here, we could not auto-complete. Surface a clear error for debugging.
  throw new Error("Could not complete 3DS challenge automatically");
}
