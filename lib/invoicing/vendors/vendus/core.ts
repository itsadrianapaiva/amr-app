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
  type?: string;               // "api" or "pos"/"normal" or similar
  status?: "open" | "close";   // session state
  situation?: "on" | "off";    // activation
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
export const DOC_TYPE = (process.env.VENDUS_DOC_TYPE || "FR") as "FT" | "FR" | "PF";

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

/**
 * Deterministic HTTP helper.
 * - No caching.
 * - Parses JSON if possible.
 * - On non-2xx throws with Vendus message when present.
 */
export async function http<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: authHeader(),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const text = await res.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    // Some Vendus responses are plain text; ignore JSON parse errors.
  }

  if (!res.ok) {
    const vErr = (parsed as VendusError) || {};
    const message = vErr.message || vErr.error || `HTTP ${res.status} ${res.statusText}`;
    throw new Error(`Vendus API error at ${path}: ${message}`);
  }
  return (parsed ?? ({} as T)) as T;
}

/** PT VAT to Vendus tax_id mapping. */
export function mapVatToTaxId(vatPercent: number): "NOR" | "INT" | "RED" | "ISE" {
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
  const parts = fmt.formatToParts(d).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}
