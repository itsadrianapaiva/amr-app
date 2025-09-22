import { describe, it, expect, vi, beforeEach } from "vitest";

// 1) Mock the resolver to always return a known client id.
vi.mock("../../../lib/invoicing/vendors/vendus/clients", async (orig) => {
  const mod = await orig<any>();
  return {
    ...mod,
    resolveOrCreateClient: vi.fn().mockResolvedValue(999), // fixed id
  };
});

// 2) Spy on core http() to capture the payload POSTed to /v1.1/documents/.
const httpSpy = vi.fn();
vi.mock("../../../lib/invoicing/vendors/vendus/core", async (orig) => {
  const mod = await orig<any>();
  return {
    ...mod,
    http: ((method: "GET" | "POST", path: string, payload: any) => {
      httpSpy({ method, path, payload });
      // minimal fake response to satisfy parseDocResponse()
      return Promise.resolve({
        id: 1234,
        number: "FT 2025/1234",
        full_number: "FT 2025/1234",
        pdf_url: "https://example.test/documents/1234.pdf",
        atcud: "ABCD-1234",
      });
    }) as typeof mod.http,
  };
});

// Import after mocks so they apply
import { createInvoiceDocument } from "../../../lib/invoicing/vendors/vendus/documents";

// Keep the params shape lean; we only care that buildCreateDocumentPayload runs
// and that our layer forces client.id. Cast to any to avoid coupling to internal types.
function makeParams(): any {
  return {
    docType: "FT",
    registerId: 1,
    input: {
      customer: {
        name: "Jane Doe",
        email: "jane@example.com",
        nif: undefined,
        address: {
          line1: "Rua das Flores 10",
          postalCode: "8500-000",
          city: "Portimão",
          country: "PT",
        },
      },

      // Keep your flat fields too — our resolver mapping reads from these
      customerName: "Jane Doe",
      customerEmail: "jane@example.com",

      lines: [
        {
          title: "Mini excavator (1 day)",
          qty: 1,
          unitPrice: 100,
          vatPercent: 23,
        },
      ],
      bookingId: 333,
    },
  };
}

describe("Vendus documents client.id injection", () => {
  beforeEach(() => {
    httpSpy.mockClear();
  });

  it("forces a concrete client.id on invoice creation payload to avoid A001", async () => {
    await createInvoiceDocument(makeParams());

    // Find the POST to /v1.1/documents/
    const call = httpSpy.mock.calls.find(
      (args) =>
        args?.[0]?.method === "POST" && args?.[0]?.path === "/v1.1/documents/"
    );

    expect(call).toBeTruthy();
    const posted = call?.[0]?.payload;

    // Assert we set client.id from the resolver (999)
    expect(posted?.client).toEqual({ id: 999 });

    // Sanity: still a fiscal doc with our register id
    expect(posted?.register_id).toBe(1);

    // Sanity: items should exist (v1.1 payload)
    expect(Array.isArray(posted?.items)).toBe(true);
    expect(posted?.items.length).toBeGreaterThan(0);
  });
});
