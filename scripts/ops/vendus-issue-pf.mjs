/**
 * Minimal Vendus v1.1 PF issuer (ops sanity check).
 * - Auth: Basic (username = VENDUS_API_KEY, empty password)
 * - Mode: respects VENDUS_MODE=tests|normal
 * - Purpose: Create a PF and print {id, number, atcud}. No PDF fetching.
 */

import process from "node:process";

const args = new Map(
  process.argv.slice(2).flatMap(a => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [[m[1], m[2]]] : [];
  })
);

const CUSTOMER = args.get("customer") || "AMR PF Health Check";
const VALUE = Number(args.get("value") || "10.00");
const MODE = (args.get("mode") || process.env.VENDUS_MODE || "tests").toLowerCase();

const RAW_URL =
  (process.env.VENDUS_BASE_URL || process.env.VENDUS_URL || "https://www.vendus.pt/ws").trim();

/** Ensure base is .../ws/v1.1 regardless of what env provides */
function normalizeBase(u) {
  let base = u.replace(/\/+$/, "");
  // If there's no "/ws" at the end, add it
  if (!/\/ws(\/v1\.1)?$/.test(base)) {
    base = base.endsWith("/ws") ? base : base + "/ws";
  }
  // Ensure v1.1 suffix
  if (!base.endsWith("/v1.1")) base = base + "/v1.1";
  return base;
}

const BASE = normalizeBase(RAW_URL);
const API_KEY = (process.env.VENDUS_API_KEY || "").trim();
if (!API_KEY) {
  console.error("Missing VENDUS_API_KEY");
  process.exit(1);
}

function authHeader() {
  const basic = Buffer.from(`${API_KEY}:`).toString("base64");
  return `Basic ${basic}`;
}

function taxCodeFor(rate = 23) {
  if (rate === 23) return "NOR";
  if (rate === 13) return "INT";
  if (rate === 6)  return "RED";
  if (rate === 0)  return "ISE";
  return "NOR";
}

async function http(path, init = {}) {
  const url = `${BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
    redirect: "follow",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Vendus ${res.status} @ ${url}: ${text || res.statusText}`);
  return text ? JSON.parse(text) : {};
}

(async () => {
  try {
    console.error(`[Vendus PF] BASE=${BASE} MODE=${MODE}`);

    const body = {
      type: "PF",
      mode: MODE,
      client: {
        name: CUSTOMER,
        fiscal_id: "517530937",
        country: "PT",
        email: "tests@example.com",
      },
      items: [
        { title: "Health Check", qty: 1, gross_price: VALUE, tax_id: taxCodeFor(23) },
      ],
    };

    const created = await http("/documents/", { method: "POST", body: JSON.stringify(body) });

    const out = {
      id: created?.id,
      number: created?.number || created?.full_number,
      atcud: created?.atcud || created?.at_code,
      mode: MODE,
    };
    console.log(JSON.stringify({ ok: true, doc: out }, null, 2));
  } catch (e) {
    console.error(JSON.stringify({ ok: false, error: String(e) }, null, 2));
    process.exit(1);
  }
})();
