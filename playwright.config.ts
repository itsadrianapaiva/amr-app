import { defineConfig, devices } from "@playwright/test";

const APP_URL =
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://127.0.0.1:8888"; // IPv4 default to avoid ::1 issues

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

  // Auto-start our app for tests. Reuse if already running locally.
  webServer: {
    command: "npx netlify dev --port 8888",
    url: APP_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },

  // Single fast project to start; we can add Firefox or WebKit later
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
