// tests/unit/notifications/notify-booking-confirmed.spec.ts
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";

// --- Mocks (isolate the orchestrator from DB, mail transport, and JSX templates) ---
vi.mock("@/lib/db", () => {
  return {
    db: {
      booking: {
        findUnique: vi.fn(),
        updateMany: vi.fn(),
      },
    },
  };
});

vi.mock("@/lib/emails/mailer", () => {
  return {
    sendEmail: vi.fn(async (_args: any) => {
      return { id: "mocked-email-id" };
    }),
  };
});

vi.mock("@/lib/notifications/mailers/customer-confirmed", () => {
  return {
    buildCustomerEmail: vi.fn((_view: any) => ({ mocked: "customer-email" } as any)),
  };
});

vi.mock("@/lib/notifications/mailers/internal-confirmed", () => {
  return {
    buildInternalEmail: vi.fn((_view: any) => ({ mocked: "internal-email" } as any)),
  };
});

// SUT
import { notifyBookingConfirmed } from "@/lib/notifications/notify-booking-confirmed";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/emails/mailer";
import { buildCustomerEmail } from "@/lib/notifications/mailers/customer-confirmed";
import { buildInternalEmail } from "@/lib/notifications/mailers/internal-confirmed";

// ---- Helpers ----
const asAny = <T>(v: unknown) => v as unknown as T;
const mockCalls = (fn: unknown) => (fn as Mock).mock.calls;

// Strongly-typed handles to mocked Prisma methods
const bookingFindUnique = () => db.booking.findUnique as unknown as Mock;
const bookingUpdateMany = () => db.booking.updateMany as unknown as Mock;

function mkBooking(overrides: Partial<any> = {}) {
  const base = {
    id: 999,
    machineId: 5,
    startDate: new Date("2025-10-05T00:00:00Z"),
    endDate: new Date("2025-10-06T00:00:00Z"),
    customerName: "Jane",
    customerEmail: "jane@example.com",
    customerPhone: "123",
    siteAddressLine1: "Rua ABC",
    siteAddressCity: "Portimão",
    insuranceSelected: true,
    deliverySelected: true,
    pickupSelected: true,
    operatorSelected: false,
    totalCost: 442.8, // VAT-inclusive
    depositPaid: false,
    invoiceNumber: null as string | null,
    invoicePdfUrl: null as string | null,
    confirmationEmailSentAt: null as Date | null,
    invoiceEmailSentAt: null as Date | null,
    machine: { name: "Mini excavator", deposit: 250 },
  };
  return { ...base, ...overrides };
}

beforeEach(() => {
  vi.useFakeTimers().setSystemTime(new Date("2025-09-23T12:00:00Z"));
  vi.clearAllMocks();

  bookingFindUnique().mockResolvedValue(mkBooking());
  bookingUpdateMany().mockResolvedValue({ count: 1 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("notifyBookingConfirmed", () => {
  it("when invoice exists at confirmation time: sends one customer email incl. link AND marks invoiceEmailSentAt", async () => {
    // Arrange
    bookingFindUnique().mockResolvedValue(
      mkBooking({
        invoiceNumber: "PF T01P2025/9",
        invoicePdfUrl: "https://www.vendus.pt/ws/v1.1/documents/285147155.pdf",
      })
    );

    // Act
    await notifyBookingConfirmed(999, "customer");

    // Assert atomic claim data
    expect(db.booking.updateMany).toHaveBeenCalledTimes(1);
    const [args] = mockCalls(db.booking.updateMany)[0];
    expect(args.where).toMatchObject({ id: 999, confirmationEmailSentAt: null });
    expect(args.data.confirmationEmailSentAt).toBeInstanceOf(Date);
    expect(args.data.invoiceEmailSentAt).toBeInstanceOf(Date);

    // Emails: one customer + one internal
    expect(buildCustomerEmail).toHaveBeenCalledTimes(1);
    expect(buildInternalEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledTimes(2);
    const tos = mockCalls(sendEmail).map((c) => c[0].to as string | string[]);
    const flat = Array.isArray(tos[0]) ? (tos[0] as string[]) : tos.map((x) => x as string);
    expect(flat.join(",")).toContain("jane@example.com");
  });

  it("when invoice does NOT exist yet: sends confirmation only (no invoiceEmailSentAt set)", async () => {
    // Arrange: default mkBooking has no invoice
    bookingFindUnique().mockResolvedValue(mkBooking());

    // Act
    await notifyBookingConfirmed(999, "customer");

    // Assert: only confirmationEmailSentAt set
    const [args] = mockCalls(db.booking.updateMany)[0];
    expect(args.data.confirmationEmailSentAt).toBeInstanceOf(Date);
    expect(Object.prototype.hasOwnProperty.call(args.data, "invoiceEmailSentAt")).toBe(false);

    // Emails: still 2 (customer + internal)
    expect(buildCustomerEmail).toHaveBeenCalledTimes(1);
    expect(buildInternalEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  it("idempotency: when updateMany.count=0, no customer email; internal still sent", async () => {
    // Arrange
    bookingUpdateMany().mockResolvedValue({ count: 0 });
    bookingFindUnique().mockResolvedValue(mkBooking());

    // Act
    await notifyBookingConfirmed(999, "customer");

    // Assert
    expect(buildCustomerEmail).not.toHaveBeenCalled();
    expect(sendEmail).toHaveBeenCalledTimes(1); // internal only
    expect(buildInternalEmail).toHaveBeenCalledTimes(1);
  });

  it("skips customer email for internal placeholder addresses; still sends internal", async () => {
    // Arrange
    bookingFindUnique().mockResolvedValue(mkBooking({ customerEmail: "x@internal.local" }));

    // Act
    await notifyBookingConfirmed(999, "customer");

    // Assert
    expect(db.booking.updateMany).not.toHaveBeenCalled();
    expect(buildCustomerEmail).not.toHaveBeenCalled();
    expect(buildInternalEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});
