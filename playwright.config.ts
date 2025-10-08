// playwright.config.ts (patch)
import { defineConfig, devices } from "@playwright/test";

/** Resolve base URL with IPv4 default to avoid ::1 issues */
const APP_URL =
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://127.0.0.1:8888";

/** When truthy, Playwright will NOT start a server and will reuse one you run manually */
const USE_EXTERNAL = !!process.env.USE_EXTERNAL_SERVER;

/** Spawn Netlify dev by default; allow override via PLAYWRIGHT_WEB_SERVER_CMD */
const WEB_SERVER_CMD =
  process.env.PLAYWRIGHT_WEB_SERVER_CMD || "npx netlify dev --port 8888";

/** Always set x-e2e-secret when provided, local or remote */
const E2E_SECRET = process.env.E2E_SECRET || "";
const EXTRA_HTTP_HEADERS: Record<string, string> | undefined =
  E2E_SECRET ? { "x-e2e-secret": E2E_SECRET } : undefined;

/** Pass ops flags through to the spawned server so build/runtime match test matrix */
const WEB_SERVER_ENV = {
  OPS_DASHBOARD_ENABLED: process.env.OPS_DASHBOARD_ENABLED,
  OPS_DISABLE_AUTH: process.env.OPS_DISABLE_AUTH,
  OPS_AUTH_DISABLED: process.env.OPS_AUTH_DISABLED, // legacy mirror
  AUTH_COOKIE_SECRET: process.env.AUTH_COOKIE_SECRET,
  APP_URL: process.env.APP_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
};

/** Ensure env fits { [key: string]: string } by dropping undefined values */
function cleanEnv(
  obj: Record<string, string | undefined>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

export default defineConfig({
  testDir: "e2e",
  workers: 1, // deterministic for DB-bound flows

  timeout: 30_000,
  expect: { timeout: 5_000 },

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,

  reporter: process.env.CI
    ? [["junit", { outputFile: "test-results/junit.xml" }]]
    : [["list"]],

  use: {
    baseURL: APP_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    extraHTTPHeaders: EXTRA_HTTP_HEADERS,
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
        env: cleanEnv(WEB_SERVER_ENV), // <-- fix: pass only strings
      },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
