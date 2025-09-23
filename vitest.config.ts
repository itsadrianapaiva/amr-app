// vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Test-only environment defaults
 * Keep unit tests deterministic when CI does not provide secrets or base URLs.
 * These run in the Vitest process only and do not affect build/runtime.
 */
const MIN_SECRET_LEN = 24;

// Provide a long dummy secret if missing or too short
if (
  !process.env.INVOICING_LINK_SECRET ||
  process.env.INVOICING_LINK_SECRET.length < MIN_SECRET_LEN
) {
  process.env.INVOICING_LINK_SECRET =
    "test_secret_0123456789abcdef_TEST_ONLY_SECRET";
}

// Provide a stable base URL only when none of the accepted vars are set
const hasAnyBaseUrl =
  !!process.env.APP_URL ||
  !!process.env.NEXT_PUBLIC_APP_URL ||
  !!process.env.URL ||
  !!process.env.DEPLOY_URL ||
  !!process.env.DEPLOY_PRIME_URL;

if (!hasAnyBaseUrl) {
  process.env.APP_URL = "http://localhost:3000";
}

export default defineConfig({
  resolve: {
    alias: [
      // Keep the Next-style "@/..." absolute imports
      { find: "@", replacement: path.resolve(__dirname, ".") },
      // Shim Next's virtual "server-only" module in unit tests
      {
        find: "server-only",
        replacement: path.resolve(__dirname, "tests/shims/server-only.ts"),
      },
    ],
  },
  test: {
    include: ["tests/**/*.{test,spec}.ts"], // only run tests in /tests
    exclude: ["e2e/**", "node_modules/**", "dist/**", ".next/**", "coverage/**"],
    environment: "node",
    setupFiles: ["tests/setup/silence-geo-logs.ts", "./tests/shims/setup.ts"],
  },
});
