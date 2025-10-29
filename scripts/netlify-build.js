const { execSync } = require("node:child_process");

const runMigrations = process.env.RUN_MIGRATIONS === "1";

if (runMigrations) {
  console.log("→ Running Prisma migrate deploy");
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
} else {
  console.log("→ Skipping Prisma migrations for this context");
}

console.log("→ Building Next.js");
execSync("next build", { stdio: "inherit" });

// NEW: emit .next/_headers on staging only (no-op elsewhere)
console.log("→ Emitting staging headers (if applicable)");
execSync("node scripts/emit-staging-headers.js", { stdio: "inherit" });
