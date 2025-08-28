"use client";

/**
 * Small, focused client for the /api/ops/calendar endpoint.
 * Keeps fetch + response shaping out of the hook to reduce file size and complexity.
 */

/** Success + error contracts returned by the calendar API. */
export type CalOk = { ok: true; eventId: string; htmlLink?: string; traceId?: string };
export type CalErr = { ok: false; formError: string; traceId?: string };
export type CalResult = CalOk | CalErr;

/** Minimal fields required by the ops calendar API payload. */
export const REQUIRED_FIELDS = [
  "machineId",
  "startYmd",
  "endYmd",
  "managerName",
  "siteAddressLine1",
] as const;

/** Return the first missing required field (or undefined if all present). */
export function missingRequiredField(
  snap: Record<string, string>
): (typeof REQUIRED_FIELDS)[number] | undefined {
  for (const k of REQUIRED_FIELDS) {
    const v = snap[k];
    if (!v || !String(v).trim()) return k;
  }
  return undefined;
}

/** Shape arbitrary JSON + header into a strict CalResult union. */
function shapeCalResult(
  data: any,
  traceId?: string
): CalResult {
  if (data && data.ok === true && typeof data.eventId === "string") {
    return { ok: true, eventId: data.eventId, htmlLink: data.htmlLink, traceId };
  }
  const formError =
    (data && typeof data.formError === "string" && data.formError) ||
    "Calendar error";
  return { ok: false, formError, traceId };
}

/**
 * POST to the ops calendar endpoint with keepalive + no-store.
 * Always returns a shaped result; never throws to the caller.
 */
export async function postOpsCalendar(
  payload: Record<string, string>
): Promise<CalResult> {
  try {
    const res = await fetch("/api/ops/calendar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      keepalive: true,
      cache: "no-store",
      credentials: "same-origin",
    });

    const traceId = res.headers.get("x-trace-id") || undefined;

    // API returns JSON even on non-2xx
    const data = await res.json().catch(() => ({}));
    return shapeCalResult(data, traceId);
  } catch (e: any) {
    return { ok: false, formError: e?.message || "Calendar request failed" };
  }
}
