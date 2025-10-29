// scripts/emit-staging-headers.js
// Emits .next/_headers for the staging branch so HTML is no-store
// and hashed assets are immutable. Adds X-Build-Id for verification.

const fs = require("node:fs");
const path = require("node:path");

const { BRANCH, CONTEXT } = process.env;
// On Netlify, staging branch => BRANCH="staging", CONTEXT="branch-deploy"
const isStaging = BRANCH === "staging" || (CONTEXT === "branch-deploy" && BRANCH === "staging");

if (!isStaging) {
  console.log("[emit-staging-headers] Not staging; skipping.");
  process.exit(0);
}

// Read BUILD_ID produced by next build
const buildIdPath = path.join(process.cwd(), ".next", "BUILD_ID");
let buildId = "unknown";
try {
  buildId = fs.readFileSync(buildIdPath, "utf8").trim();
} catch {
  console.warn("[emit-staging-headers] BUILD_ID not found; continuing with 'unknown'.");
}

// Build header rules:
// - HTML: no-store so we never serve old HTML pointing to new chunks
// - Hashed next assets: immutable, 1y
// - Non-fingerprinted public assets: short cache to avoid surprises
const lines = [
  "/*",
  "  Cache-Control: no-cache, no-store, must-revalidate",
  `  X-Build-Id: ${buildId}`,
  "",
  "/_next/static/*",
  "  Cache-Control: public, max-age=31536000, immutable",
  "",
  "/_next/image*",
  "  Cache-Control: public, max-age=31536000, immutable",
  "",
  "/assets/*",
  "  Cache-Control: public, max-age=300",
  "",
];

const outFile = path.join(process.cwd(), ".next", "_headers");
fs.writeFileSync(outFile, lines.join("\n") + "\n", "utf8");
console.log(`[emit-staging-headers] Wrote ${outFile}`);
