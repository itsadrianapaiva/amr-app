const { execSync } = require("node:child_process");

const runMigrations = process.env.RUN_MIGRATIONS === "1";

// NEW: emit staging-only _headers before building
console.log("→ Preparing staging headers (if BRANCH=staging)");
execSync("node scripts/write-staging-headers.js", { stdio: "inherit" });

if (runMigrations) {
  console.log("→ Running Prisma migrate deploy");
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
} else {
  console.log("→ Skipping Prisma migrations for this context");
}

console.log("→ Building Next.js");
execSync("next build", { stdio: "inherit" });
