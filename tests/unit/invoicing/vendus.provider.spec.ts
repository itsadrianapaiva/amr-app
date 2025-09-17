import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("vendusProvider.createInvoice", () => {
  const OLD_ENV = process.env;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...OLD_ENV };

    // Adapter reads env at module load time
    process.env.VENDUS_API_KEY = "test_api_key";
    process.env.VENDUS_BASE_URL = "https://vendus.example/ws";
    process.env.VENDUS_MODE = "tests";
    process.env.VENDUS_DOC_TYPE = "FR";
    process.env.VENDUS_REGISTER_ID = "123"; // avoid hitting /registers in tests

    // Use stubGlobal so TypeScript is happy with the signature
    fetchMock = vi.fn(async (input: any, init?: any) => {
      expect(init?.method).toBe("POST");
      expect((init?.headers as any)?.Authorization).toMatch(/^Basic /);

      const body = JSON.parse(String(init?.body || "{}"));

      // Core payload expectations
      expect(body).toMatchObject({
        type: "FR",
        mode: "tests",
        register_id: 123,
        output: "pdf_url",
        return_qrcode: 1,
        currency: "EUR",
      });

      // Item mapping (net price; 23% -> NOR)
      expect(body.products?.[0]).toMatchObject({
        name: "Excavator - 2 days (2025-09-01 to 2025-09-02)",
        qty: 2,
        price: 150,
        tax_id: "NOR",
        reference: "machine:Excavator",
      });

      const doc = {
        id: 42,
        full_number: "FR 2025/42",
        atcud: "ABCD-42",
        pdf_url: "https://vendus.cdn/documents/42.pdf",
        qrcode_data: "QR:...",
      };

      // Minimal fetch-like response for Vitest
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => JSON.stringify(doc),
      } as any;
    });

    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = OLD_ENV;
  });

  it("sends tests-mode FR with net pricing and parses number/atcud/pdf", async () => {
    // Import after env so vendus.ts reads our test env
    const { vendusProvider } = await import("../../../lib/invoicing/vendus");

    const record = await vendusProvider.createInvoice({
      idempotencyKey: "booking:1:pi:pi_123",
      externalRef: "pi_123",
      issuedAt: new Date("2025-09-02T12:00:00Z"),
      currency: "EUR",
      customer: {
        name: "João Silva",
        email: "joao@example.com",
        nif: "123456789",
        address: {
          line1: "Rua A, 10",
          city: "Portimão",
          postalCode: "8500-000",
          country: "PT",
        },
      },
      lines: [
        {
          description: "Excavator - 2 days (2025-09-01 to 2025-09-02)",
          quantity: 2,
          unitPriceCents: 15000,
          vatPercent: 23,
          itemRef: "machine:Excavator",
        },
      ],
      notes: "Obrigado pela preferencia",
    });

    expect(record).toEqual({
      provider: "vendus",
      providerInvoiceId: "42",
      number: "FR 2025/42",
      atcud: "ABCD-42",
      pdfUrl: "https://vendus.cdn/documents/42.pdf",
    });

    // Ensure endpoint correctness
    const calledUrlArg = fetchMock.mock.calls[0][0];
    const calledUrl = typeof calledUrlArg === "string" ? calledUrlArg : String(calledUrlArg);
    expect(calledUrl).toMatch(/\/v1\.1\/documents\/$/);
  });
});
