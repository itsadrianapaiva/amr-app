import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    // Map "@/…" to the repo root, matching your Next.js alias usage.
    alias: { "@": path.resolve(__dirname, ".") },
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
    setupFiles: ["tests/setup/silence-geo-logs.ts"],
  },
});
