import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks (declare before importing the SUT) ---

// Mock DB layer: capture calls to findUnique / updateMany
const findUnique = vi.fn();
const updateMany = vi.fn();
vi.mock("@/lib/db", () => ({
  db: { booking: { findUnique, updateMany } },
}));

// Mock email sender
const sendEmail = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/emails/mailer", () => ({ sendEmail }));

// Mock link builder so we don't depend on env or HMAC tokens
vi.mock("@/lib/emails/invoice-link", () => ({
  buildInvoiceLinkSnippet: (id: number) => ({
    url: `https://example.test/invoice/${id}`,
    text: "",
    html: "",
  }),
}));

// Mock the email template to avoid JSX/React runtime during the unit test
vi.mock("@/lib/emails/templates/invoice-ready", () => ({
  default: () => null,
  subjectForInvoiceReady: (id: number, n?: string) =>
    n ? `Your AMR invoice ${n} for booking #${id}` : `Your AMR invoice for booking #${id}`,
}));

// --- SUT (import after mocks) ---
import { notifyInvoiceReady } from "@/lib/notifications/notify-invoice-ready";

describe("notifyInvoiceReady", () => {
  beforeEach(() => {
    findUnique.mockReset();
    updateMany.mockReset();
    sendEmail.mockReset();
  });

  it("sends exactly once even if called twice (idempotent via updateMany claim)", async () => {
    // Booking has invoice persisted and a real email
    findUnique.mockResolvedValue({
      id: 42,
      customerName: "Ana",
      customerEmail: "ana@example.com",
      invoiceNumber: "FT-2025-0001",
      invoicePdfUrl: "https://vendor/pdf/1",
      invoiceEmailSentAt: null,
    });

    // First call claims the send, second call sees it already claimed
    updateMany
      .mockResolvedValueOnce({ count: 1 }) // winner → sends
      .mockResolvedValueOnce({ count: 0 }); // loser → skips

    await notifyInvoiceReady(42);
    await notifyInvoiceReady(42);

    expect(updateMany).toHaveBeenCalledTimes(2);
    expect(sendEmail).toHaveBeenCalledTimes(1);

    const [payload] = sendEmail.mock.calls[0];
    expect(payload.to).toBe("ana@example.com");
    expect(payload.subject).toMatch(/invoice/i);
  });

  it("no-ops when invoice fields are missing", async () => {
    // Invoice not yet persisted → should return early
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
    // Internal/test address → should not send
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
