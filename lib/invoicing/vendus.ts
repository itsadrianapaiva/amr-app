import "server-only";
import type {
  InvoicingProvider,
  InvoiceCreateInput,
  InvoiceRecord,
  CreditNoteCreateInput,
  CreditNoteRecord,
  ProviderHealth,
} from "./provider";

// Small helpers kept local to this adapter to avoid leaking vendor details.
type VendusRegister = { id: number; type: string; status: "on" | "off"; title: string };
type VendusDocResponse = {
  id: number;
  number?: string;        // sometimes "123" or "2025/123"
  full_number?: string;   // some APIs return "FT 2025/123"
  at_code?: string;       // ATCUD if configured
};
type VendusError = { error?: string; message?: string };

const BASE_URL = process.env.VENDUS_URL?.replace(/\/+$/, "") || "https://www.vendus.pt/ws";
const API_KEY = process.env.VENDUS_API_KEY;
if (!API_KEY) {
  throw new Error("Missing VENDUS_API_KEY env");
}

function authHeader() {
  // Basic auth with API key as username and empty password.
  const token = Buffer.from(`${API_KEY}:`).toString("base64");
  return `Basic ${token}`;
}

async function http<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: authHeader(),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    // Vendus returns JSON for errors; no-cache keeps CI/dev deterministic.
    cache: "no-store",
  });

  // Try to parse JSON either way to surface useful error info
  const text = await res.text();
  let parsed: any = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { /* non-JSON, ignore */ }

  if (!res.ok) {
    const vErr = (parsed as VendusError) || {};
    const message = vErr.message || vErr.error || `HTTP ${res.status} ${res.statusText}`;
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
  throw new Error(`Unsupported VAT percent ${vatPercent}. Allowed: 0, 6, 13, 23.`);
}

// Format a JS Date as YYYY-MM-DD in Europe/Lisbon.
function lisbonYmd(d: Date): string {
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

// Auto-discover an enabled API register if env not provided.
async function resolveRegisterId(): Promise<number> {
  const envId = process.env.VENDUS_REGISTER_ID;
  if (envId) {
    const id = Number(envId);
    if (!Number.isFinite(id)) throw new Error("VENDUS_REGISTER_ID must be a number");
    return id;
  }

  // Vendus registers live under v1.0
  const regs = await http<VendusRegister[]>("GET", "/v1.0/registers/");
  const apiReg = regs.find((r) => r.type === "api" && r.status === "on");
  if (!apiReg) {
    const titles = regs.map((r) => `${r.id}:${r.type}:${r.status}`).join(", ");
    throw new Error(`No enabled API register found. Seen: [${titles}]`);
  }
  return apiReg.id;
}

// Convert provider-agnostic lines to Vendus products payload.
function toVendusProducts(lines: InvoiceCreateInput["lines"]) {
  return lines.map((l) => {
    const price = Number((l.unitPriceCents / 100).toFixed(2));
    const tax_id = mapVatToTaxId(l.vatPercent);
    if (tax_id === "ISE" && !l.vatExemptionCode) {
      throw new Error("VAT 0 requires a legal exemption code in InvoiceLine.vatExemptionCode");
    }
    // Vendus accepts a simple product object per document line.
    return {
      name: l.description,
      qty: l.quantity,
      price,
      tax_id,                // NOR, INT, RED, ISE
      exemption_reason: l.vatExemptionCode, // only if ISE
      reference: l.itemRef,
    };
  });
}

// Build Vendus client object that implements our provider interface.
export const vendusProvider: InvoicingProvider = {
  async healthCheck(): Promise<ProviderHealth> {
    try {
      await resolveRegisterId();
      return { ok: true };
    } catch (e: any) {
      return { ok: false, message: String(e?.message || e) };
    }
  },

  async getInvoicePdf(providerInvoiceId: string): Promise<string> {
    // Vendus PDF endpoint under v1.1
    return `${BASE_URL}/v1.1/documents/${providerInvoiceId}.pdf`;
  },

  async createInvoice(input: InvoiceCreateInput): Promise<InvoiceRecord> {
    const registerId = await resolveRegisterId();

    // Minimal client fields. We only send what we have.
    const cli = input.customer;
    const addr = cli.address;
    const clientPayload = {
      name: cli.name,
      email: cli.email,
      fiscal_id: cli.nif,               // optional for B2C
      address: addr?.line1,
      postalcode: addr?.postalCode,
      city: addr?.city,
      country: addr?.country || "PT",
    };

    const products = toVendusProducts(input.lines);

    // Construct document create payload.
    // Type FT (Fatura). If your accountant prefers FR, change here.
    const payload = {
      type: "FT",
      date: lisbonYmd(input.issuedAt),
      register_id: registerId,
      client: clientPayload,
      products,
      currency: input.currency,               // "EUR"
      external_reference: input.externalRef,  // Stripe PI id
      notes: input.notes,
      // If you need to finalize immediately and your account requires it,
      // Vendus typically finalizes automatically for FT. We omit extra flags.
    };

    const res = await http<VendusDocResponse>("POST", "/v1.1/documents/", payload);

    const number = res.full_number || res.number || String(res.id);
    const pdfUrl = await this.getInvoicePdf(String(res.id));

    return {
      provider: "vendus",
      providerInvoiceId: String(res.id),
      number,
      atcud: res.at_code, // if your series has validation code configured
      pdfUrl,
    };
  },

  async createCreditNote(input: CreditNoteCreateInput): Promise<CreditNoteRecord> {
    const registerId = await resolveRegisterId();

    // When lines are omitted we cannot legally create an ISE doc without a reason.
    // For now, require explicit lines so amounts are clear. We can enhance later
    // to fetch original lines before issuing a full credit.
    const products = input.lines ? toVendusProducts(input.lines) : undefined;
    if (!products) {
      throw new Error("createCreditNote requires lines for now. We will add 'full credit' by fetching the original document in a later iteration.");
    }

    const payload = {
      type: "NC", // Nota de crédito
      date: lisbonYmd(new Date()),
      register_id: registerId,
      client: undefined,              // Vendus links client via related_id
      products,
      related_id: Number(input.original.providerInvoiceId), // link to original
      notes: input.reason,
    };

    const res = await http<VendusDocResponse>("POST", "/v1.1/documents/", payload);
    const number = res.full_number || res.number || String(res.id);
    const pdfUrl = `${BASE_URL}/v1.1/documents/${res.id}.pdf`;

    return {
      provider: "vendus",
      providerCreditNoteId: String(res.id),
      number,
      pdfUrl,
    };
  },
};
