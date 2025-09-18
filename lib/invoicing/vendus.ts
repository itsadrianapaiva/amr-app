import "server-only";
import type {
  InvoicingProvider,
  InvoiceCreateInput,
  InvoiceRecord,
  CreditNoteCreateInput,
  CreditNoteRecord,
  ProviderHealth,
} from "./provider";

type DocType = "FT" | "FR" | "PF" | "NC"; // include NC (credit notes)

// Small helpers kept local to this adapter to avoid leaking vendor details.
type VendusRegister = {
  id: number;
  type?: string;
  status?: string;
  title?: string;
};
type VendusRegisterDetail = {
  id: number;
  type?: string; // 'api', 'pos', ...
  status?: "open" | "close"; // register session state
  situation?: "on" | "off"; // activation
  mode?: "normal" | "tests";
  document_type_id?: string; // default doc type
  title?: string;
};
type VendusDocResponse = {
  id: number;
  number?: string; // "123" or "2025/123"
  full_number?: string; // "FR 2025/123"
  atcud?: string; // some accounts return this key
  at_code?: string; // others return this key for ATCUD
  qrcode_data?: string; // string payload for QR
  pdf_url?: string; // when output=pdf_url
  output_url?: string; // some payloads use output_url
};
type VendusError = { error?: string; message?: string };

const BASE_URL = (
  process.env.VENDUS_BASE_URL ||
  process.env.VENDUS_URL ||
  "https://www.vendus.pt/ws"
).replace(/\/+$/, "");

const API_KEY = process.env.VENDUS_API_KEY;
if (!API_KEY) {
  throw new Error("Missing VENDUS_API_KEY env");
}

// Safe defaults:
// - mode tests prevents AT communication until you flip it
// - FR matches “money received now” for your full-upfront flow
const MODE = (process.env.VENDUS_MODE || "tests") as "tests" | "normal";
const DOC_TYPE = (process.env.VENDUS_DOC_TYPE || "FR") as "FT" | "FR" | "PF";

function authHeader() {
  // Basic auth with API key as username and empty password.
  const token = Buffer.from(`${API_KEY}:`).toString("base64");
  return `Basic ${token}`;
}

// Low-level HTTP: remove Next’s conflicting "next: { revalidate: 0 }" to silence Netlify warning.
// Keep fetch deterministic with cache: 'no-store'.
async function http<T>(
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
  });

  const text = await res.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    /* ignore */
  }

  if (!res.ok) {
    const vErr = (parsed as VendusError) || {};
    const message =
      vErr.message || vErr.error || `HTTP ${res.status} ${res.statusText}`;
    throw new Error(`Vendus API error at ${path}: ${message}`);
  }
  return (parsed ?? ({} as T)) as T;
}

// Map VAT percent to Vendus tax_id.
// PT common: 23 -> "NOR" (standard), 13 -> "INT" (intermediate), 6 -> "RED" (reduced), 0 -> "ISE" (exempt)
function mapVatToTaxId(vatPercent: number): "NOR" | "INT" | "RED" | "ISE" {
  if (vatPercent === 23) return "NOR";
  if (vatPercent === 13) return "INT";
  if (vatPercent === 6) return "RED";
  if (vatPercent === 0) return "ISE";
  throw new Error(
    `Unsupported VAT percent ${vatPercent}. Allowed: 0, 6, 13, 23.`
  );
}

// Format a JS Date as YYYY-MM-DD in Europe/Lisbon.
function lisbonYmd(d: Date): string {
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

// Auto-discover an enabled API register if env not provided.
async function resolveRegisterId(): Promise<number> {
  const envId = process.env.VENDUS_REGISTER_ID;
  if (envId) {
    const id = Number(envId);
    if (!Number.isFinite(id))
      throw new Error("VENDUS_REGISTER_ID must be a number");
    return id;
  }
  // v1.0 list is fine for discovery.
  const regs = await http<VendusRegister[]>("GET", "/v1.0/registers/");
  // Prefer an API register that’s active; field names vary across versions, be tolerant.
  const apiReg = regs.find(
    (r) => r.type === "api" || /api/i.test(r.type || "")
  );
  if (!apiReg) {
    const titles = regs.map((r) => `${r.id}:${r.type}:${r.status}`).join(", ");
    throw new Error(`No API register found. Seen: [${titles}]`);
  }
  return apiReg.id;
}

// Fetch register detail (v1.1) and assert it can issue fiscal docs now.
async function assertRegisterCanIssue(registerId: number, docType: DocType) {
  const detail = await http<VendusRegisterDetail>(
    "GET",
    `/v1.1/registers/${registerId}/`
  );

  // Must be API-type for programmatic issuance.
  if (detail.type && detail.type !== "api") {
    throw new Error(
      `Vendus register ${registerId} is type "${detail.type}", not "api". In backoffice set register Type to API (Programmatic integration).`
    );
  }

  // FR, FT, and NC are fiscal docs; they typically require the register to be OPEN
  if (
    (docType === "FR" || docType === "FT" || docType === "NC") &&
    detail.status === "close"
  ) {
    throw new Error(
      `Vendus register ${registerId} is CLOSED. Open the register session in backoffice before issuing ${docType}.`
    );
  }

  // Optional sanity hint on modes; we still send mode in payload.
  if (MODE === "tests" && detail.mode === "normal") {
    // not fatal, just a hint — payload mode overrides
    // noop
  }
}

// Convert provider-agnostic lines to Vendus products payload (net price).
function toVendusProducts(lines: InvoiceCreateInput["lines"]) {
  return lines.map((l) => {
    const price = Number((l.unitPriceCents / 100).toFixed(2)); // net
    const tax_id = mapVatToTaxId(l.vatPercent);
    if (tax_id === "ISE" && !l.vatExemptionCode) {
      throw new Error(
        "VAT 0 requires a legal exemption code in InvoiceLine.vatExemptionCode"
      );
    }
    return {
      name: l.description,
      qty: l.quantity,
      price, // net; Vendus will add VAT from tax_id
      tax_id, // NOR, INT, RED, ISE
      exemption_reason: l.vatExemptionCode, // only if ISE
      reference: l.itemRef,
    };
  });
}

// Build Vendus client object that implements our provider interface.
export const vendusProvider: InvoicingProvider = {
  async healthCheck(): Promise<ProviderHealth> {
    try {
      const id = await resolveRegisterId();
      await assertRegisterCanIssue(id, DOC_TYPE);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, message: String(e?.message || e) };
    }
  },

  async getInvoicePdf(providerInvoiceId: string): Promise<string> {
    // Fallback direct PDF endpoint; in create we will prefer pdf_url if present.
    return `${BASE_URL}/v1.1/documents/${providerInvoiceId}.pdf`;
  },

  async createInvoice(input: InvoiceCreateInput): Promise<InvoiceRecord> {
    const registerId = await resolveRegisterId();
    await assertRegisterCanIssue(registerId, DOC_TYPE);

    // Minimal client fields. We only send what we have.
    const cli = input.customer;
    const addr = cli.address;
    const clientPayload = {
      name: cli.name,
      email: cli.email,
      fiscal_id: cli.nif, // optional for B2C
      address: addr?.line1,
      postalcode: addr?.postalCode,
      city: addr?.city,
      country: addr?.country || "PT",
    };

    const products = toVendusProducts(input.lines);

    // Construct document create payload.
    const payload = {
      type: DOC_TYPE, // FR for money received; FT if you invoice before payment; PF for pro-forma
      mode: MODE, // tests by default to avoid AT comms while validating
      date: lisbonYmd(input.issuedAt),
      register_id: registerId,
      client: clientPayload,
      products,
      currency: input.currency, // "EUR"
      external_reference: input.idempotencyKey || input.externalRef,
      notes: input.notes,
      // Return a stable URL and QR payload for ops checks
      output: "pdf_url",
      return_qrcode: 1,
    };

    const res = await http<VendusDocResponse>(
      "POST",
      "/v1.1/documents/",
      payload
    );

    const number = res.full_number || res.number || String(res.id);
    // prefer vendor-rendered URL; fallback to deterministic .pdf path
    const pdfUrl =
      res.pdf_url ||
      res.output_url ||
      (await this.getInvoicePdf(String(res.id)));
    const atcud = res.atcud || res.at_code || undefined;

    return {
      provider: "vendus",
      providerInvoiceId: String(res.id),
      number,
      atcud,
      pdfUrl,
    };
  },

  async createCreditNote(
    input: CreditNoteCreateInput
  ): Promise<CreditNoteRecord> {
    const registerId = await resolveRegisterId();
    await assertRegisterCanIssue(registerId, "NC"); // will only check 'closed' for fiscal; NC is fiscal too

    const products = input.lines ? toVendusProducts(input.lines) : undefined;
    if (!products) {
      throw new Error(
        "createCreditNote requires lines for now. We will add 'full credit' by fetching the original document in a later iteration."
      );
    }

    const payload = {
      type: "NC", // Nota de crédito
      mode: MODE,
      date: lisbonYmd(new Date()),
      register_id: registerId,
      client: undefined, // Vendus links client via related_id
      products,
      related_id: Number(input.original.providerInvoiceId), // link to original
      notes: input.reason,
      output: "pdf_url",
      return_qrcode: 1,
    };

    const res = await http<VendusDocResponse>(
      "POST",
      "/v1.1/documents/",
      payload
    );
    const number = res.full_number || res.number || String(res.id);
    const pdfUrl =
      res.pdf_url ||
      res.output_url ||
      `${BASE_URL}/v1.1/documents/${res.id}.pdf`;

    return {
      provider: "vendus",
      providerCreditNoteId: String(res.id),
      number,
      pdfUrl,
    };
  },
};
