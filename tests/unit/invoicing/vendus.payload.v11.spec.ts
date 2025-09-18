import { describe, it, expect, beforeAll } from "vitest";
import { buildCreateDocumentPayload } from "@/lib/invoicing/vendors/vendus/payload";
import type { InvoiceCreateInput } from "@/lib/invoicing/provider";

// Ensure stable mode for assertions
beforeAll(() => {
  process.env.VENDUS_MODE = "tests";
});

function sampleInput(
  overrides: Partial<InvoiceCreateInput> = {}
): InvoiceCreateInput {
  const base: InvoiceCreateInput = {
    idempotencyKey: "booking:326:pi:pi_123",
    externalRef: "pi_123",
    issuedAt: new Date("2025-09-18T12:00:00Z"),
    currency: "EUR",
    customer: {
      name: "Ada Lovelace",
      email: "ada@example.com",
      nif: "123456789",
      address: {
        line1: "Rua das Flores 1",
        city: "Porto",
        postalCode: "4000-001",
        country: "PT",
      },
    },
    lines: [
      {
        description: "Excavator rental — 3 days (2025-09-20 to 2025-09-22)",
        quantity: 3,
        unitPriceCents: 15000, // €150 net / day
        vatPercent: 23,
        itemRef: "machine:excavator",
      },
    ],
    notes: "Test note",
  };
  return { ...base, ...overrides };
}

describe("Vendus v1.1 payload builder", () => {
  it("emits FT with items (title, gross_price) and no currency", () => {
    const input = sampleInput();
    const payload = buildCreateDocumentPayload({
      docType: "FT",
      registerId: 123,
      input,
    });

    // Top-level basics
    expect(payload.type).toBe("FT");
    expect(payload.mode).toBe("tests");
    expect(payload.register_id).toBe(123);
    expect(payload.output).toBe("pdf_url");
    expect(payload.return_qrcode).toBe(1);

    // Date formatted as YYYY-MM-DD Lisbon
    expect(payload.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // No currency field in v1.1
    // @ts-expect-error currency is intentionally not allowed
    expect(payload.currency).toBeUndefined();

    // Items shape (not products)
    // @ts-expect-error products must not exist
    expect(payload.products).toBeUndefined();
    expect(Array.isArray(payload.items)).toBe(true);
    const item = payload.items[0];
    expect(item.title).toMatch(/Excavator rental/);
    expect(item.qty).toBe(3);

    // gross_price = net * (1 + VAT)
    // net 150.00 -> gross 184.50
    expect(item.gross_price).toBeCloseTo(184.5, 3);
    expect(item.tax_id).toBe("NOR");
    expect(item.reference).toBe("machine:excavator");
  });

  it("omits client.country for PT, but keeps valid non-PT country", () => {
    // PT should be omitted
    const payloadPT = buildCreateDocumentPayload({
      docType: "PF",
      registerId: 1,
      input: sampleInput({}),
    });
    expect(payloadPT.client).toBeDefined();
    expect((payloadPT.client as any).country).toBeUndefined();

    // ES should be preserved - coerce in test to bypass provider's narrow type
    const inputES = sampleInput();
    (inputES.customer.address as any) = {
      ...inputES.customer.address!,
      country: "es", // ✅ coerced for test purposes only
    };
    const payloadES = buildCreateDocumentPayload({
      docType: "PF",
      registerId: 1,
      input: inputES,
    });
    expect((payloadES.client as any).country).toBe("ES");
  });
});
