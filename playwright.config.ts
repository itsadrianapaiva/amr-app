// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  // Only look in our E2E folder
  testDir: "e2e",

  // Keep runs deterministic for DB-bound flows
  workers: 1,

  // Reasonable default timeouts
  timeout: 30_000,
  expect: { timeout: 5_000 },

  // Base URL used by request/context.goto — lines up with our tests
  use: {
    baseURL:
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000",
  },

  // Single fast project to start; we can add Firefox/WebKit later
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
