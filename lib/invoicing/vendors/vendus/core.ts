import "server-only";

/**
 * Shared types and low-level HTTP for the Vendus adapter.
 * Pure and easy to unit test by mocking global fetch in Vitest.
 */

export type DocType = "FT" | "FR" | "PF" | "NC";

export type VendusRegister = {
  id: number;
  store_id?: number;
  title?: string;
  status?: "open" | "close";
};

export type VendusRegisterDetail = {
  id: number;
  type?: string; // "api" or "pos"/"normal" or similar
  status?: "open" | "close"; // session state
  situation?: "on" | "off"; // activation
  mode?: "normal" | "tests";
  document_type_id?: string;
  title?: string;
};

export type VendusDocResponse = {
  id: number;
  number?: string;
  full_number?: string;
  atcud?: string;
  at_code?: string;
  qrcode_data?: string;
  pdf_url?: string;
  output_url?: string;
};

export type VendusError = { error?: string; message?: string };

export const BASE_URL = (
  process.env.VENDUS_BASE_URL ||
  process.env.VENDUS_URL ||
  "https://www.vendus.pt/ws"
).replace(/\/+$/, "");

export const MODE = (process.env.VENDUS_MODE || "tests") as "tests" | "normal";
export const DOC_TYPE = (process.env.VENDUS_DOC_TYPE || "FR") as
  | "FT"
  | "FR"
  | "PF";

/** Read the API key only when needed so imports never throw. */
function getApiKey(): string {
  const key = process.env.VENDUS_API_KEY || "";
  if (!key) throw new Error("Missing VENDUS_API_KEY env");
  return key;
}

/** Basic auth header: username is the API key, empty password. */
export function authHeader(): string {
  const token = Buffer.from(`${getApiKey()}:`).toString("base64");
  return `Basic ${token}`;
}

/** Trim long bodies for error messages without leaking too much content. */
function snippet(s: string | null, max = 400): string {
  if (!s) return "";
  const trimmed = s.slice(0, max);
  return s.length > max ? `${trimmed}...[truncated]` : trimmed;
}

/**
 * Deterministic HTTP helper.
 * - No caching.
 * - Parses JSON if possible.
 * - On non-2xx throws with Vendus message when present and includes request/response context.
 */
export async function http<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: authHeader(),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    redirect: "follow",
  });

  const contentType = res.headers.get("content-type") || "";
  const raw = await res.text();

  // Try to parse JSON, but allow plain text
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    // Prefer Vendus' structured message when available
    const v = (parsed as VendusError) || {};
    const baseMsg =
      v.message?.toString() ||
      v.error?.toString() ||
      `${res.status} ${res.statusText}`;

    // Append short raw body even when parsed succeeded, for opaque 403s
    const bodyPart =
      raw && !v.message && !v.error
        ? ` - body: ${snippet(raw)}`
        : raw
          ? ` - body: ${snippet(raw)}`
          : "";

    // Minimal request/response context that helps debugging and is safe to log
    const ctx = `ctx: method=${method} path=${path} mode=${MODE} docType=${DOC_TYPE} contentType=${contentType}`;

    // Gentle hints for the common staging 403 basket without being prescriptive
    const hint =
      res.status === 403
        ? " Hint: check register open state, document series permissions, and tests vs normal mode."
        : "";

    throw new Error(
      `Vendus API error at ${path}: ${baseMsg}${bodyPart} (${ctx}).${hint}`
    );
  }

  // If no JSON body, return empty object casted to T
  return (parsed ?? {}) as T;
}

/** PT VAT to Vendus tax_id mapping. */
export function mapVatToTaxId(
  vatPercent: number
): "NOR" | "INT" | "RED" | "ISE" {
  if (vatPercent === 23) return "NOR";
  if (vatPercent === 13) return "INT";
  if (vatPercent === 6) return "RED";
  if (vatPercent === 0) return "ISE";
  throw new Error("Unsupported VAT percent. Allowed: 0, 6, 13, 23.");
}

/** Format Date as YYYY-MM-DD in Europe/Lisbon for Vendus 'date' fields. */
export function lisbonYmd(d: Date): string {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt
    .formatToParts(d)
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}
