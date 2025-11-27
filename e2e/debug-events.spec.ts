// e2e/debug-events.spec.ts
import { test, expect } from "@playwright/test";

/**
 * E2E tests for the analytics debug page at /debug/events.
 *
 * This test suite ensures:
 * - The debug page is reachable in non-production environments
 * - GA4 and Meta Pixel test buttons are rendered
 * - Clicking debug buttons invokes gtag and fbq when stubs are present
 */

test.describe("Analytics Debug Events Page", () => {
  test("renders debug events UI and sections", async ({ page }) => {
    // Navigate to the debug events page with debug mode enabled
    await page.goto("/debug/events?debug_mode=1");

    // Verify page loads successfully
    expect(page.url()).toContain("/debug/events");

    // Check for main heading
    await expect(
      page.getByRole("heading", { name: /Analytics Debug Panel/i })
    ).toBeVisible();

    // Verify diagnostics section content
    await expect(page.getByText(/Debug Mode:/)).toBeVisible();
    await expect(page.getByText(/Environment:/)).toBeVisible();
    await expect(page.getByText(/GA4 Available:/)).toBeVisible();
    await expect(page.getByText(/Meta Pixel Available:/)).toBeVisible();

    // Verify GA4 Test Events section
    await expect(
      page.getByRole("heading", { name: "GA4 Test Events" })
    ).toBeVisible();

    // Check GA4 event buttons exist
    await expect(
      page.getByRole("button", { name: /Fire GA4 test page_view/ })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Fire GA4 test view_item_list/ })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Fire GA4 test begin_checkout/ })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Fire GA4 test purchase/ })
    ).toBeVisible();

    // Verify Meta Pixel Test Events section
    await expect(
      page.getByRole("heading", { name: "Meta Pixel Test Events" })
    ).toBeVisible();

    // Check Meta event buttons exist
    await expect(
      page.getByRole("button", { name: /Fire Meta test PageView/ })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Fire Meta test catalog ViewContent/ })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Fire Meta test ViewContent \(machine\)/ })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Fire Meta test InitiateCheckout/ })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Fire Meta test Purchase/ })
    ).toBeVisible();
  });

  test("invokes gtag and fbq when firing debug events", async ({ page }) => {
    // Inject tracking stubs before page loads
    await page.addInitScript(() => {
      // GA4 stub
      (window as any).__gtagCalls = [];
      (window as any).gtag = (...args: any[]) => {
        (window as any).__gtagCalls.push(args);
      };

      // Meta Pixel stub
      (window as any).__fbqCalls = [];
      (window as any).fbq = (...args: any[]) => {
        (window as any).__fbqCalls.push(args);
      };
    });

    // Set analytics consent cookie before navigating
    await page.context().addCookies([
      {
        name: "amr_consent",
        value: encodeURIComponent(JSON.stringify({ analytics: true })),
        domain: "localhost",
        path: "/",
      },
    ]);

    // Navigate to debug page
    await page.goto("/debug/events?debug_mode=1");

    // Wait for page to be fully loaded
    await expect(
      page.getByRole("heading", { name: /Analytics Debug Panel/i })
    ).toBeVisible();

    // Click GA4 test buttons
    await page.getByRole("button", { name: /Fire GA4 test page_view/ }).click();
    await page.waitForTimeout(100);

    await page.getByRole("button", { name: /Fire GA4 test view_item_list/ }).click();
    await page.waitForTimeout(100);

    await page.getByRole("button", { name: /Fire GA4 test begin_checkout/ }).click();
    await page.waitForTimeout(100);

    await page.getByRole("button", { name: /Fire GA4 test purchase/ }).click();
    await page.waitForTimeout(100);

    // Click Meta test buttons
    await page.getByRole("button", { name: /Fire Meta test PageView/ }).click();
    await page.waitForTimeout(100);

    await page
      .getByRole("button", { name: /Fire Meta test catalog ViewContent/ })
      .click();
    await page.waitForTimeout(100);

    await page
      .getByRole("button", { name: /Fire Meta test ViewContent \(machine\)/ })
      .click();
    await page.waitForTimeout(100);

    await page
      .getByRole("button", { name: /Fire Meta test InitiateCheckout/ })
      .click();
    await page.waitForTimeout(100);

    await page.getByRole("button", { name: /Fire Meta test Purchase/ }).click();

    // Give events time to fire (wait for async handlers)
    await page.waitForTimeout(1000);

    // Verify GA4 calls were made
    const gtagCalls = await page.evaluate(() => (window as any).__gtagCalls);
    expect(gtagCalls).toBeDefined();
    expect(gtagCalls.length).toBeGreaterThanOrEqual(2);

    // Check for specific GA4 event names
    const gtagEventNames = gtagCalls
      .filter((call: any[]) => call[0] === "event")
      .map((call: any[]) => call[1]);

    // Verify at least page_view and purchase events fired
    // (These are the directly-called gtag events in the handlers)
    expect(gtagEventNames).toContain("page_view");
    expect(gtagEventNames).toContain("purchase");

    // Verify Meta Pixel calls were made
    const fbqCalls = await page.evaluate(() => (window as any).__fbqCalls);
    expect(fbqCalls).toBeDefined();
    expect(fbqCalls.length).toBeGreaterThanOrEqual(2);

    // Check for specific Meta event names
    const fbqEventNames = fbqCalls
      .filter((call: any[]) => call[0] === "track" || call[0] === "trackCustom")
      .map((call: any[]) => call[1]);

    // Verify at least PageView and Purchase events fired
    expect(fbqEventNames).toContain("PageView");
    expect(fbqEventNames).toContain("Purchase");
  });
});
