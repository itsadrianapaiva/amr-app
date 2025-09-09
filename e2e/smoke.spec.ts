import { test, expect } from '@playwright/test';

// Purpose: prove the browser boots in this environment without hitting your app.
// This also clears the "missing dependencies" warning once deps are installed.
test('browser boots and can open a blank page', async ({ page }) => {
  await page.goto('about:blank');        // Launches browser and navigates to a simple built-in URL
  await expect(page).toBeDefined();      // Sanity assertion so the test has an expectation
});
