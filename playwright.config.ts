import { defineConfig, devices } from "@playwright/test";

const APP_URL =
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://127.0.0.1:8888";

// When truthy, Playwright will NOT start a server and will reuse one you run manually.
const USE_EXTERNAL = !!process.env.USE_EXTERNAL_SERVER;

// Default command (unused when USE_EXTERNAL=1)
const WEB_SERVER_CMD =
  process.env.PLAYWRIGHT_WEB_SERVER_CMD || "npx netlify dev --port 8888";

/** 
 * Always attach x-e2e-secret when E2E_SECRET is provided,
 * regardless of http/https, so local prod runs hit dev-gated routes.
 */
const E2E_SECRET = process.env.E2E_SECRET || "";
const EXTRA_HTTP_HEADERS: Record<string, string> | undefined =
  E2E_SECRET ? { "x-e2e-secret": E2E_SECRET } : undefined;

export default defineConfig({
  testDir: "e2e",
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [["junit", { outputFile: "test-results/junit.xml" }]]
    : [["list"]],
  use: {
    baseURL: APP_URL,
    extraHTTPHeaders: EXTRA_HTTP_HEADERS, // ← now applies locally too
  },
  webServer: USE_EXTERNAL
    ? undefined
    : {
        command: WEB_SERVER_CMD,
        url: APP_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        stdout: "pipe",
        stderr: "pipe",
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
