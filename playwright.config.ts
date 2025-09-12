import { defineConfig, devices } from "@playwright/test";

const APP_URL =
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://127.0.0.1:8888"; // IPv4 default to avoid ::1 issues

// Toggle: when truthy, Playwright will NOT start a server and will reuse one you run manually.
const USE_EXTERNAL = !!process.env.USE_EXTERNAL_SERVER;

// Command to start the app in managed mode (Playwright spawns it).
// Default: Netlify dev on 8888. You can override via PLAYWRIGHT_WEB_SERVER_CMD.
const WEB_SERVER_CMD =
  process.env.PLAYWRIGHT_WEB_SERVER_CMD || "npx netlify dev --port 8888";

export default defineConfig({
  // Look only in our E2E folder
  testDir: "e2e",

  // Keep runs deterministic for DB-bound flows
  workers: 1,

  // Reasonable default timeouts
  timeout: 30_000,
  expect: { timeout: 5_000 },

  // Fail on accidental .only in CI
  forbidOnly: !!process.env.CI,

  // Retry flake in CI only
  retries: process.env.CI ? 2 : 0,

  // Reporters: concise locally, JUnit on CI (good for GitHub Actions)
  reporter: process.env.CI
    ? [["junit", { outputFile: "test-results/junit.xml" }]]
    : [["list"]],

  // Base URL used by request and page.goto
  use: {
    baseURL: APP_URL,
  },

  // Auto-start only if we're NOT reusing an external server
  webServer: USE_EXTERNAL
    ? undefined
    : {
        command: WEB_SERVER_CMD,
        url: APP_URL,
        reuseExistingServer: !process.env.CI, // don't double-start locally
        timeout: 180_000, // give cold starts time
        stdout: "pipe",
        stderr: "pipe",
      },

  // Single fast project to start; we can add Firefox or WebKit later
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
