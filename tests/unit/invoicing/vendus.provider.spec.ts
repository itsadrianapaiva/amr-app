import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Stub the Vendus client resolver so provider tests never hit GET /v1.1/clients/
vi.mock("../../../lib/invoicing/vendors/vendus/clients", async (orig) => {
  const mod = await orig<any>();
  return {
    ...mod,
    resolveOrCreateClient: vi.fn().mockResolvedValue(123), // fixed Vendus client id
  };
});

// Create a virtual stub for Next.js' "server-only" (kept from your original)
(vi as any).mock("server-only", () => ({}), { virtual: true });

describe("vendusProvider.createInvoice (v1.1)", () => {
  const OLD_ENV = process.env;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...OLD_ENV };

    // Adapter reads env at module load time
    process.env.VENDUS_API_KEY = "test_api_key";
    process.env.VENDUS_BASE_URL = "https://vendus.example/ws";
    process.env.VENDUS_MODE = "tests";
    process.env.VENDUS_DOC_TYPE = "FT"; // default to FT now (MVP path)
    process.env.VENDUS_REGISTER_ID = "123"; // keep preflight minimal

    //  mock allows GET preflights and asserts POST only for /documents
    fetchMock = vi.fn(async (input: any, init?: any) => {
      const url = String(typeof input === "string" ? input : input?.url || "");
      const method = (init?.method || "GET").toUpperCase();

      // Basic auth should be present on all calls
      const auth = (init?.headers as any)?.Authorization ?? "";
      expect(auth).toMatch(/^Basic /);

      // Allow GET register list/detail preflights
      if (method === "GET" && /\/v1\.(0|1)\/registers(\/\d+)?\/?$/.test(url)) {
        const body = /\/registers\/\d+/.test(url)
          ? {
              id: 123,
              type: "api",
              status: "open",
              situation: "on",
              mode: "tests",
            }
          : [
              {
                id: 123,
                type: "api",
                status: "open",
                situation: "on",
                mode: "tests",
              },
            ];
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () => JSON.stringify(body),
          headers: { get: () => "application/json" },
        } as any;
      }

      // Assert POST for document creation
      if (method === "POST" && /\/v1\.1\/documents\/?$/.test(url)) {
        const body = JSON.parse(String(init?.body || "{}"));

        // New v1.1 expectations
        expect(body).toMatchObject({
          type: "FT",
          mode: "tests",
          register_id: 123,
          output: "pdf_url",
          return_qrcode: 1,
        });

        // v1.1 must NOT include currency
        expect((body as any).currency).toBeUndefined();

        // items (not products) with title + gross_price
        expect(Array.isArray(body.items)).toBe(true);
        const item = body.items[0];
        expect(item).toMatchObject({
          title: "Excavator - 2 days (2025-09-01 to 2025-09-02)", //  name→title
          qty: 2,
          tax_id: "NOR",
          reference: "machine:Excavator",
        });
        // gross_price = 150 * 1.23 = 184.5 (two decimals kept as number)
        expect(item.gross_price).toBeCloseTo(184.5, 3);

        const doc = {
          id: 42,
          full_number: "FT T01P2025/1", //  FT numbering now
          atcud: "ABCD-42",
          pdf_url: "https://vendus.cdn/documents/42.pdf",
          qrcode_data: "QR:...",
        };

        return {
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () => JSON.stringify(doc),
          headers: { get: () => "application/json" },
        } as any;
      }

      // Any other call is unexpected here
      return {
        ok: false,
        status: 500,
        statusText: "Not mocked",
        text: async () => "not mocked",
        headers: { get: () => "text/plain" },
      } as any;
    });

    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = OLD_ENV;
  });

  it("sends tests-mode FT with items (title,gross_price) and parses number/atcud/pdf", async () => {
    // Import after env so vendus adapter reads our test env
    const { vendusProvider } = await import("../../../lib/invoicing/vendus"); // unchanged path

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
      number: "FT T01P2025/1", // FT numbering
      atcud: "ABCD-42",
      pdfUrl: "https://vendus.cdn/documents/42.pdf",
    });

    //  Ensure we did hit the documents endpoint with POST (sequence may include GETs)
    const hits = fetchMock.mock.calls.map(([u, i]) => ({
      url: typeof u === "string" ? u : String(u),
      method: (i?.method || "GET").toUpperCase(),
    }));
    expect(
      hits.some(
        (h) => h.method === "POST" && /\/v1\.1\/documents\/?$/.test(h.url)
      )
    ).toBe(true);
  });
});
