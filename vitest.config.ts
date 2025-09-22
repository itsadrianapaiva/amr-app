import { defineConfig } from "vitest/config";
import path from "node:path";

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
    exclude: [
      "e2e/**",
      "node_modules/**",
      "dist/**",
      ".next/**",
      "coverage/**",
    ],
    environment: "node",
    setupFiles: ["tests/setup/silence-geo-logs.ts", "./tests/shims/setup.ts"],
  },
});
