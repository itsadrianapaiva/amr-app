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

/** Parse Vendus doc response into our Invoice/CreditNote record parts. */
function parseDocResponse(res: VendusDocResponse) {
  const number = res.full_number || res.number || String(res.id);
  const pdfUrl =
    res.pdf_url || res.output_url || `${BASE_URL}/v1.1/documents/${res.id}.pdf`;
  const atcud = res.atcud || res.at_code || undefined;
  return { id: String(res.id), number, pdfUrl, atcud };
}

/** Create an invoice-like document (FR, FT, or PF). */
export async function createInvoiceDocument(params: {
  docType: Exclude<DocType, "NC">; // FR | FT | PF
  registerId: number;
  input: InvoiceCreateInput;
}): Promise<InvoiceRecord> {
  const payload = buildCreateDocumentPayload(params);
  const res = await http<VendusDocResponse>(
    "POST",
    "/v1.1/documents/",
    payload
  );
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

  // Guard: credit notes must specify at least one line (we don't yet support "full credit" fetch).
  const lines = input.lines;
  if (!lines || lines.length === 0) {
    throw new Error(
      "createCreditNote requires lines. Future work: support 'full credit' by fetching the original document."
    );
  }

  // v1.1 requires "items" top-level; convert our lines using the v1.1 mapper.
  const items = toVendusItems(lines);
  const payload = {
    type: "NC" as const, // Nota de crédito
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

  const res = await http<VendusDocResponse>(
    "POST",
    "/v1.1/documents/",
    payload
  );
  const { id, number, pdfUrl } = parseDocResponse(res);

  return {
    provider: "vendus",
    providerCreditNoteId: id,
    number,
    pdfUrl,
  };
}
