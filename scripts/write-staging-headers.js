// scripts/write-staging-headers.js
// Purpose: On the staging branch only, emit public/_headers that disables caching
// for HTML and all Next assets, preventing stale chunk mismatches.

const fs = require("node:fs");
const path = require("node:path");

const { BRANCH, CONTEXT } = process.env;
// Netlify sets BRANCH="staging" on the staging branch; CONTEXT is "branch-deploy" there.
const isStaging = BRANCH === "staging" || (CONTEXT === "branch-deploy" && BRANCH === "staging");

if (!isStaging) {
  console.log("[headers] Not staging; skipping _headers write.");
  process.exit(0);
}

const lines = [
  "/*",
  "  Cache-Control: no-cache, no-store, must-revalidate",
  "",
  "/_next/*",
  "  Cache-Control: no-store",
  "",
  "/_next/static/*",
  "  Cache-Control: no-store",
  "",
];

const outFile = path.join(process.cwd(), "public", "_headers");
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, lines.join("\n"), "utf8");

console.log(`[headers] Wrote staging _headers → ${outFile}`);
