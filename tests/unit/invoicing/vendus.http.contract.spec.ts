import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { resolveOrCreateClient, type VendusCore } from "@/lib/invoicing/vendors/vendus/clients";
import { createInvoiceDocument } from "@/lib/invoicing/vendors/vendus/documents";

const ORIGINAL_ENV = { ...process.env };

/** Utility to create a typed fetch mock compatible with `typeof fetch`. */
function makeFetchMock(
  impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
) {
  const fn = vi.fn(impl) as unknown as typeof fetch;
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  process.env = { ...ORIGINAL_ENV };
  process.env.VENDUS_API_KEY = "test_key";
  process.env.VENDUS_MODE = "tests";
  process.env.VENDUS_URL = "https://www.vendus.pt/ws"; // default base
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...ORIGINAL_ENV };
});

describe("Vendus HTTP contract", () => {
  it("GET to /clients has NO body and NO `mode` param", async () => {
    const fetchMock = makeFetchMock(async (input, init) => {
      const url = String(input);
      expect(url).toMatch(/^https:\/\/www\.vendus\.pt\/ws\/v1\.1\/clients\/\?/);
      expect(url).not.toContain("mode=");             // <-- critical: no `mode` on GET
      expect(init?.method).toBe("GET");
      expect(init?.body).toBeUndefined();             // <-- no body on GET
      // No Content-Type header expected for GET-without-body
      const ct =
        (init?.headers as Record<string, string> | undefined)?.["Content-Type"] ??
        (init?.headers as Headers | undefined)?.get?.("Content-Type");
      expect(ct).toBeUndefined();

      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    // A DI-friendly VendusCore that performs a GET with query string only
    const core: VendusCore = {
      async request<T>(
        method: "GET" | "POST" | "PATCH",
        path: string,
        opts?: { query?: Record<string, unknown> }
      ): Promise<T> {
        if (method !== "GET") throw new Error("Test core only supports GET here");
        const qs = new URLSearchParams();
        for (const [k, v] of Object.entries(opts?.query || {})) {
          if (v === null || v === undefined) continue;
          const s = String(v).trim();
          if (!s) continue;
          qs.append(k, s);
        }
        const full = `https://www.vendus.pt/ws${path}${qs.toString() ? `?${qs}` : ""}`;
        const res = await fetch(full, {
          method: "GET",
          headers: { Authorization: "Basic dGVzdF9rZXk6" },
        });
        const text = await res.text();
        return (text ? JSON.parse(text) : {}) as T;
      },
      log: () => {},
    };

    await resolveOrCreateClient(
      core,
      { email: "person@example.com", name: "Person" },
      "tests"
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("POST to /documents includes `mode` in JSON body and GETs remain body-less", async () => {
    const calls: { url: string; init?: RequestInit; body?: any }[] = [];

    const fetchMock = makeFetchMock(async (input, init) => {
      const url = String(input);
      let parsedBody: any = undefined;
      if (init?.body) {
        try {
          parsedBody = JSON.parse(String(init.body));
        } catch {
          parsedBody = init.body;
        }
      }
      calls.push({ url, init, body: parsedBody });

      // Simulate the clients GET during client resolution
      if (url.includes("/v1.1/clients/") && (!init || init.method === "GET")) {
        // Return a single candidate so the flow uses that id
        return new Response(JSON.stringify([{ id: 777 }]), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      // Simulate successful document creation
      if (url.endsWith("/v1.1/documents/") && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            id: 12345,
            full_number: "FT T01/2025/123",
            atcud: "ABCD-123",
            pdf_url: "https://www.vendus.pt/ws/v1.1/documents/12345.pdf",
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      return new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const record = await createInvoiceDocument({
      docType: "FT",
      registerId: 99,
      input: {
        bookingId: 42,
        startDate: new Date("2025-10-05T00:00:00Z"),
        endDate: new Date("2025-10-06T00:00:00Z"),
        machineName: "Mini excavator",
        unitDailyCents: 19900,
        vatPercent: 23,
        customerName: "Jane Doe",
        customerEmail: "jane@example.com",
        customerNIF: "123456789",
      } as any,
    });

    // Assert result shape
    expect(record.number).toBe("FT T01/2025/123");
    expect(record.pdfUrl).toMatch(/\/v1\.1\/documents\/12345\.pdf$/);

    // Assert POST body has mode=tests
    const post = calls.find(c => c.url.endsWith("/v1.1/documents/") && c.init?.method === "POST");
    expect(post).toBeTruthy();
    const ct =
      (post?.init?.headers as Record<string, string> | undefined)?.["Content-Type"] ??
      (post?.init?.headers as Headers | undefined)?.get?.("Content-Type");
    expect(ct).toBe("application/json");
    expect(post?.body?.mode).toBe("tests");

    // Assert all GETs had no body
    const anyGetWithBody = calls.some(c => c.init?.method === "GET" && c.init?.body);
    expect(anyGetWithBody).toBe(false);

    expect(fetchMock).toHaveBeenCalled();
  });
});
