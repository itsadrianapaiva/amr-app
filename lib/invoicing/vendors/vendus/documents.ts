import "server-only";
import { http, BASE_URL, MODE, lisbonYmd } from "./core";
import type { DocType, VendusDocResponse } from "./core";
import { buildCreateDocumentPayload, toVendusItems } from "./payload";
import type {
  InvoiceCreateInput,
  InvoiceRecord,
  CreditNoteCreateInput,
  CreditNoteRecord,
} from "../../provider";
import {
  resolveOrCreateClient,
  type ClientInput,
  type VendusCore,
} from "./clients";

type VendusModeT = "normal" | "tests";

/** Parse Vendus doc response into our Invoice/CreditNote record parts. */
function parseDocResponse(res: VendusDocResponse) {
  const number = res.full_number || res.number || String(res.id);
  const pdfUrl =
    res.pdf_url || res.output_url || `${BASE_URL}/v1.1/documents/${res.id}.pdf`;
  const atcud = res.atcud || res.at_code || undefined;
  return { id: String(res.id), number, pdfUrl, atcud };
}

/** Small helper to safely read optional properties without hard-coding types. */
function pick<T = string>(obj: any, ...keys: string[]): T | undefined {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      return v as T;
    }
  }
  return undefined;
}

/** Map our InvoiceCreateInput into a Vendus ClientInput (tolerant to field names). */
function mapInvoiceToClientInput(input: InvoiceCreateInput): ClientInput {
  const fiscalId =
    pick<string>(input, "customerNIF") ??
    pick<string>(input, "billingTaxId") ??
    pick<string>(input, "taxId");

  const email =
    pick<string>(input, "customerEmail") ?? pick<string>(input, "email");

  const name =
    pick<string>(input, "customerName") ??
    pick<string>(input, "billingCompanyName") ??
    pick<string>(input, "name") ??
    (email ? email.split("@")[0] : undefined);

  const address =
    pick<string>(input, "billingAddressLine1") ??
    pick<string>(input, "addressLine1");

  const postalcode =
    pick<string>(input, "billingPostalCode") ??
    pick<string>(input, "postalCode");

  const city =
    pick<string>(input, "billingCity") ?? pick<string>(input, "city");

  const country =
    pick<string>(input, "billingCountry") ?? pick<string>(input, "country");

  const external_reference = pick<number | string>(input, "bookingId", "id")
    ? `booking:${pick<number | string>(input, "bookingId", "id")}`
    : undefined;

  return {
    fiscalId,
    email,
    name,
    address,
    postalcode,
    city,
    country,
    external_reference,
  };
}

/** Build query string from a record, skipping null/undefined/"" */
function toQueryString(rec?: Record<string, unknown>): string {
  if (!rec) return "";
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(rec)) {
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (!s) continue;
    usp.append(k, s);
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
}

/** Thin adapter around our http(): GET uses query string, POST uses JSON body. */
const vendusCore: VendusCore = {
  async request<T>(
    method: "GET" | "POST",
    path: string,
    opts?: {
      query?: Record<string, unknown>;
      json?: unknown;
      mode?: VendusModeT;
      contentType?: string;
    }
  ): Promise<T> {
    // Always pass MODE through, but…
    if (method === "GET") {
      // …GET MUST NOT have a body. Encode query params into the URL.
      const qs = toQueryString({ ...(opts?.query || {}), mode: MODE as VendusModeT });
      return http<T>("GET", `${path}${qs}`, undefined);
    }

    // POST carries JSON body; merge MODE into payload so Vendus sees it.
    const payload =
      opts?.json && typeof opts.json === "object"
        ? { ...(opts.json as Record<string, unknown>), mode: MODE as VendusModeT }
        : { mode: MODE as VendusModeT };

    return http<T>("POST", path, payload);
  },
  log(msg: string, extra?: Record<string, unknown>) {
    console.info(msg, extra);
  },
};

/** Create an invoice-like document (FR, FT, or PF). */
export async function createInvoiceDocument(params: {
  docType: Exclude<DocType, "NC">; // FR | FT | PF
  registerId: number;
  input: InvoiceCreateInput;
}): Promise<InvoiceRecord> {
  const { input } = params;

  // 1) Resolve or create a concrete Vendus client and get its ID.
  const clientInput = mapInvoiceToClientInput(input);
  const clientId = await resolveOrCreateClient(vendusCore, clientInput, MODE);

  // 2) Build the standard v1.1 payload, then force client.id to avoid Vendus A001 ambiguity.
  const payload: any = buildCreateDocumentPayload(params);
  payload.client = { id: clientId };

  // 3) Issue the document.
  const res = await http<VendusDocResponse>("POST", "/v1.1/documents/", payload);
  const { id, number, pdfUrl, atcud } = parseDocResponse(res);

  return {
    provider: "vendus",
    providerInvoiceId: id,
    number,
    pdfUrl,
    atcud,
  };
}

/** Create a credit note (NC) for a previous provider document id. */
export async function createCreditNoteDocument(params: {
  registerId: number;
  input: CreditNoteCreateInput;
}): Promise<CreditNoteRecord> {
  const { registerId, input } = params;

  const lines = input.lines;
  if (!lines || lines.length === 0) {
    throw new Error(
      "createCreditNote requires lines. Future work: support 'full credit' by fetching the original document."
    );
  }

  const items = toVendusItems(lines);
  const payload = {
    type: "NC" as const,
    mode: MODE,
    date: lisbonYmd(new Date()),
    register_id: registerId,
    client: undefined, // Vendus links client via related_id
    items,
    related_id: Number(input.original.providerInvoiceId),
    notes: input.reason,
    output: "pdf_url",
    return_qrcode: 1,
  };

  const res = await http<VendusDocResponse>("POST", "/v1.1/documents/", payload);
  const { id, number, pdfUrl } = parseDocResponse(res);

  return {
    provider: "vendus",
    providerCreditNoteId: id,
    number,
    pdfUrl,
  };
}
