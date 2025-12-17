// Scheduled every 5 minutes (UTC). Calls the Next API route to expire holds.

import type { Config, Context } from "@netlify/functions";

// 1) Declare schedule inline, as per docs
export const config: Config = {
  schedule: "*/5 * * * *", // every 5 minutes
};

// 2) Select base URL and track which env var was used
function selectBase(): { base: string; source: string } {
  if (process.env.APP_URL) return { base: process.env.APP_URL, source: "APP_URL" };
  if (process.env.DEPLOY_PRIME_URL)
    return { base: process.env.DEPLOY_PRIME_URL, source: "DEPLOY_PRIME_URL" };
  if (process.env.DEPLOY_URL) return { base: process.env.DEPLOY_URL, source: "DEPLOY_URL" };
  if (process.env.URL) return { base: process.env.URL, source: "URL" };
  return { base: "http://localhost:8888", source: "localhost_fallback" };
}

// 3) Small timeout helper to avoid silent hangs
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

// 4) Default export handler (modern Netlify Functions contract)
export default async (_req: Request, _ctx: Context): Promise<Response> => {
  const { base, source: baseSource } = selectBase();
  const baseNoSlash = base.replace(/\/$/, "");
  const secret = process.env.CRON_SECRET;

  // Build endpoint with query param auth as fallback (survives redirects)
  const endpoint = secret
    ? `${baseNoSlash}/api/cron/expire-holds?token=${encodeURIComponent(secret)}`
    : `${baseNoSlash}/api/cron/expire-holds`;

  const headers: Record<string, string> = {
    "user-agent": "amr-cron/expire-holds",
  };
  // Keep header auth for direct calls (redundant but harmless)
  if (secret) headers["x-cron-secret"] = secret;

  const endpointUrl = new URL(endpoint);
  const tokenPresent = !!secret;
  const headerPresent = !!secret;

  // Log start (safe diagnostic info, no secrets)
  console.log(
    JSON.stringify({
      event: "start",
      baseSource,
      baseHost: new URL(base).hostname,
      token_present: tokenPresent,
      header_present: headerPresent,
    })
  );

  try {
    // Log request (safe: host + path only, no query params)
    console.log(
      JSON.stringify({
        event: "request",
        endpointHost: endpointUrl.hostname,
        endpointPath: endpointUrl.pathname,
      })
    );

    const res = await fetchWithTimeout(
      endpoint,
      { method: "GET", headers },
      25000
    );
    const text = await res.text(); // capture once for logs

    // Log response (truncate body to 500 chars)
    console.log(
      JSON.stringify({
        event: "response",
        status: res.status,
        ok: res.ok,
        body: text.substring(0, 500),
      })
    );

    if (!res.ok) {
      return new Response(
        `expire-holds failed: ${res.status} ${text}`,
        { status: 500 }
      );
    }
    return new Response(`expire-holds OK: ${text}`, { status: 200 });
  } catch (err: any) {
    const errMsg = err?.message ?? String(err);
    // Log error
    console.log(
      JSON.stringify({
        event: "error",
        message: errMsg,
      })
    );
    return new Response(`expire-holds error: ${errMsg}`, {
      status: 500,
    });
  }
};
