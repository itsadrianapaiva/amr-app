import { describe, it, expect, vi, beforeEach } from "vitest";

// make JSX safe in Vitest by mocking React + jsx-runtime ---
vi.mock("react", () => ({
  default: { createElement: () => null },
  createElement: () => null,
}));
vi.mock("react/jsx-runtime", () => ({
  jsx: () => null,
  jsxs: () => null,
  Fragment: "fragment",
}));

// Hoist-safe test doubles (Vitest hoists vi.mock calls)
const { findUnique, updateMany, sendEmail } = vi.hoisted(() => {
  return {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    sendEmail: vi.fn().mockResolvedValue(undefined),
  };
});

// Optional: if not already shimmed globally
vi.mock("server-only", () => ({}));

// Mock DB layer before importing SUT
vi.mock("@/lib/db", () => ({
  db: { booking: { findUnique, updateMany } },
}));

// Mock mailer
vi.mock("@/lib/emails/mailer", () => ({ sendEmail }));

// Mock link builder so we don’t depend on env/HMAC
vi.mock("@/lib/emails/invoice-link", () => ({
  buildInvoiceLinkSnippet: (id: number) => ({
    url: `https://example.test/invoice/${id}`,
    text: "",
    html: "",
  }),
}));

// Mock template to avoid heavy JSX rendering
vi.mock("@/lib/emails/templates/invoice-ready", () => ({
  default: () => null,
  subjectForInvoiceReady: (id: number, n?: string) =>
    n
      ? `Your AMR invoice ${n} for booking #${id}`
      : `Your AMR invoice for booking #${id}`,
}));

// SUT (after mocks)
import { notifyInvoiceReady } from "@/lib/notifications/notify-invoice-ready";

describe("notifyInvoiceReady", () => {
  beforeEach(() => {
    findUnique.mockReset();
    updateMany.mockReset();
    sendEmail.mockReset();
  });

  it("sends exactly once even if called twice (idempotent via updateMany claim)", async () => {
    findUnique.mockResolvedValue({
      id: 42,
      customerName: "Ana",
      customerEmail: "ana@example.com",
      invoiceNumber: "FT-2025-0001",
      invoicePdfUrl: "https://vendor/pdf/1",
      invoiceEmailSentAt: null,
    });

    updateMany
      .mockResolvedValueOnce({ count: 1 }) // first call wins → send
      .mockResolvedValueOnce({ count: 0 }); // second call loses → skip

    await notifyInvoiceReady(42);
    await notifyInvoiceReady(42);

    expect(updateMany).toHaveBeenCalledTimes(2);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const [payload] = sendEmail.mock.calls[0];
    expect(payload.to).toBe("ana@example.com");
    expect(payload.subject).toMatch(/invoice/i);
  });

  it("no-ops when invoice fields are missing", async () => {
    findUnique.mockResolvedValue({
      id: 99,
      customerName: "João",
      customerEmail: "joao@example.com",
      invoiceNumber: null,
      invoicePdfUrl: null,
      invoiceEmailSentAt: null,
    });

    await notifyInvoiceReady(99);

    expect(updateMany).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("skips internal placeholder addresses", async () => {
    findUnique.mockResolvedValue({
      id: 77,
      customerName: "Test",
      customerEmail: "x@internal.local",
      invoiceNumber: "FT-1",
      invoicePdfUrl: "https://vendor/pdf/2",
      invoiceEmailSentAt: null,
    });

    await notifyInvoiceReady(77);

    expect(updateMany).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
