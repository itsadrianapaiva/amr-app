// Scheduled every 1 minute (UTC). Calls the Next API route to process booking jobs.

import type { Config, Context } from "@netlify/functions";

// 1) Declare schedule inline
export const config: Config = {
  schedule: "*/1 * * * *", // every 1 minute
};

// 2) Validate that a string is a valid absolute http/https URL
function isValidAbsoluteHttpUrl(value: string | undefined): boolean {
  if (!value || value.trim().length === 0) return false;
  // Reject literal placeholder strings like "$DEPLOY_PRIME_URL"
  if (value.trim().startsWith("$")) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// 3) Select base URL and track which env var was used
// Explicit override: CRON_BASE_URL takes precedence for deterministic env-specific targeting
// Fallback: context-aware selection (production uses URL, staging uses DEPLOY_PRIME_URL/DEPLOY_URL)
function selectBase(): { base: string; source: string; context: string } {
  const context = process.env.CONTEXT?.trim() || "";
  const isProduction = context === "production";

  // 1) Explicit override: if CRON_BASE_URL is set and valid, use it
  const cronBase = process.env.CRON_BASE_URL;
  if (isValidAbsoluteHttpUrl(cronBase)) {
    return { base: cronBase!, source: "CRON_BASE_URL", context };
  }

  // 2) Fallback: context-aware auto-selection
  // Production: prefer URL (custom domain), then deploy URLs
  // Staging/branch: prefer DEPLOY_PRIME_URL/DEPLOY_URL (deploy-specific), then URL
  const candidates: Array<{ value: string | undefined; source: string }> = isProduction
    ? [
        { value: process.env.URL, source: "URL" },
        { value: process.env.DEPLOY_URL, source: "DEPLOY_URL" },
        { value: process.env.DEPLOY_PRIME_URL, source: "DEPLOY_PRIME_URL" },
        { value: process.env.APP_URL, source: "APP_URL" },
      ]
    : [
        { value: process.env.DEPLOY_PRIME_URL, source: "DEPLOY_PRIME_URL" },
        { value: process.env.DEPLOY_URL, source: "DEPLOY_URL" },
        { value: process.env.URL, source: "URL" },
        { value: process.env.APP_URL, source: "APP_URL" },
      ];

  for (const { value, source } of candidates) {
    if (isValidAbsoluteHttpUrl(value)) {
      return { base: value!, source, context };
    }
  }

  return { base: "http://localhost:8888", source: "localhost_fallback", context };
}

// 4) Small timeout helper to avoid silent hangs
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

// 5) Default export handler (modern Netlify Functions contract)
export default async (_req: Request, _ctx: Context): Promise<Response> => {
  const { base, source: baseSource, context } = selectBase();
  const baseNoSlash = base.replace(/\/$/, "");
  const secret = process.env.CRON_SECRET;

  // Build endpoint with query param auth as fallback (survives redirects)
  const endpoint = secret
    ? `${baseNoSlash}/api/cron/process-booking-jobs?token=${encodeURIComponent(secret)}`
    : `${baseNoSlash}/api/cron/process-booking-jobs`;

  const headers: Record<string, string> = {
    "user-agent": "amr-cron/process-booking-jobs",
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
      context,
      baseSource,
      baseHost: new URL(base).hostname,
      token_present: tokenPresent,
      header_present: headerPresent,
      env_vars_present: {
        CRON_BASE_URL: !!process.env.CRON_BASE_URL,
        DEPLOY_PRIME_URL: !!process.env.DEPLOY_PRIME_URL,
        DEPLOY_URL: !!process.env.DEPLOY_URL,
        URL: !!process.env.URL,
      },
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
        `process-booking-jobs failed: ${res.status} ${text}`,
        { status: 500 }
      );
    }
    return new Response(`process-booking-jobs OK: ${text}`, { status: 200 });
  } catch (err: any) {
    const errMsg = err?.message ?? String(err);
    // Log error
    console.log(
      JSON.stringify({
        event: "error",
        message: errMsg,
      })
    );
    return new Response(`process-booking-jobs error: ${errMsg}`, {
      status: 500,
    });
  }
};
