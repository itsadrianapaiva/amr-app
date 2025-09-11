// Netlify Scheduled Function: runs every 5 minutes to expire stale holds.
// This calls your existing Next API route so all expiry logic stays DRY.

import type { Handler } from "@netlify/functions";

export const config = {
  // Every 5 minutes
  schedule: "*/5 * * * *",
};

// Small fetch with timeout to avoid silent hangs
async function fetchWithTimeout(input: RequestInfo, init: RequestInit = {}, ms = 25000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

export const handler: Handler = async () => {
  // Prefer production URL, fall back to deploy URL, then APP_URL, then local dev.
  const base =
    process.env.URL ||
    process.env.DEPLOY_URL ||
    process.env.APP_URL ||
    "http://localhost:8888";

  const endpoint = `${base.replace(/\/$/, "")}/api/cron/expire-holds`;

  const headers: Record<string, string> = {
    "user-agent": "amr-cron/expire-holds",
  };
  if (process.env.CRON_SECRET) headers["x-cron-secret"] = process.env.CRON_SECRET;

  try {
    const res = await fetchWithTimeout(endpoint, { method: "GET", headers }, 25000);
    const text = await res.text(); // capture once

    if (!res.ok) {
      // Surface details in Netlify logs for quick diagnosis
      return {
        statusCode: 500,
        body: `expire-holds failed: ${res.status} ${text}`,
      };
    }

    // Pass through the API response so logs show cancelled counts
    return {
      statusCode: 200,
      body: `expire-holds OK: ${text}`,
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: `expire-holds error: ${(err as Error).message}`,
    };
  }
};