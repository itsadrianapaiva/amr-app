// Netlify Scheduled Function: runs every 5 minutes to expire stale holds.
// This calls your existing Next API route so all expiry logic stays DRY.

import type { Handler } from "@netlify/functions";

export const config = {
  // Every 5 minutes
  schedule: "*/5 * * * *",
};

export const handler: Handler = async () => {
  // Prefer production URL, fall back to deploy URL, then APP_URL, then local dev.
  const base =
    process.env.URL ||
    process.env.DEPLOY_URL ||
    process.env.APP_URL ||
    "http://localhost:8888";

  const endpoint = `${base.replace(/\/$/, "")}/api/cron/expire-holds`;

  // Optional: secure the route with a shared key via header
  const headers: Record<string, string> = {};
  if (process.env.CRON_SECRET)
    headers["x-cron-secret"] = process.env.CRON_SECRET;

  const res = await fetch(endpoint, { method: "GET", headers });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // Returning 500 makes the failure visible in Netlify logs
    return {
      statusCode: 500,
      body: `expire-holds failed: ${res.status} ${text}`,
    };
  }

  return {
    statusCode: 200,
    body: "expire-holds OK",
  };
};
