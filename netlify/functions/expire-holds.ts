// Scheduled every 5 minutes (UTC). Calls the Next API route to expire holds.

import type { Config, Context } from "@netlify/functions";

// 1) Declare schedule inline, as per docs
export const config: Config = {
  schedule: "*/5 * * * *", // every 5 minutes
};

// 2) Small timeout helper to avoid silent hangs
async function fetchWithTimeout(
  input: RequestInfo,
  init: RequestInit = {},
  ms = 25000
) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

// 3) Default export handler (modern Netlify Functions contract)
export default async (_req: Request, _ctx: Context): Promise<Response> => {
  const base =
    process.env.URL || // production published URL
    process.env.DEPLOY_PRIME_URL || // preview deploy URL (won't schedule, but safe)
    process.env.DEPLOY_URL ||
    process.env.APP_URL ||
    "http://localhost:8888";

  const endpoint = `${base.replace(/\/$/, "")}/api/cron/expire-holds`;

  const headers: Record<string, string> = {
    "user-agent": "amr-cron/expire-holds",
  };
  if (process.env["CRON_SECRET"])
    headers["x-cron-secret"] = process.env["CRON_SECRET"];

  try {
    const res = await fetchWithTimeout(
      endpoint,
      { method: "GET", headers },
      25000
    );
    const text = await res.text(); // capture once for logs

    if (!res.ok) {
      return new Response(`expire-holds failed: ${res.status} ${text}`, {
        status: 500,
      });
    }
    return new Response(`expire-holds OK: ${text}`, { status: 200 });
  } catch (err: any) {
    return new Response(`expire-holds error: ${err?.message ?? String(err)}`, {
      status: 500,
    });
  }
};
