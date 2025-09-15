import "server-only";

/** Runtime-only accessor for CRON_SECRET that avoids build-time inlining. */
export function getCronSecret(): string {
  const v = process.env["CRON_SECRET"];
  if (!v) throw new Error("Missing CRON_SECRET");
  return v;
}
