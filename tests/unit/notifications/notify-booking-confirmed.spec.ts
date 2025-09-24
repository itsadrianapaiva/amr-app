import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";

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
    buildCustomerEmail: vi.fn(
      (_view: any) => ({ mocked: "customer-email" }) as any
    ),
  };
});

vi.mock("@/lib/notifications/mailers/internal-confirmed", () => {
  return {
    buildInternalEmail: vi.fn(
      (_view: any) => ({ mocked: "internal-email" }) as any
    ),
  };
});

// SUT
import { notifyBookingConfirmed } from "@/lib/notifications/notify-booking-confirmed";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/emails/mailer";
import { buildCustomerEmail } from "@/lib/notifications/mailers/customer-confirmed";
import { buildInternalEmail } from "@/lib/notifications/mailers/internal-confirmed";

// ---- Helpers ----
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
    internalEmailSentAt: null as Date | null,
    machine: { name: "Mini excavator", deposit: 250 },
  };
  return { ...base, ...overrides };
}

beforeEach(() => {
  vi.useFakeTimers().setSystemTime(new Date("2025-09-23T12:00:00Z"));
  vi.clearAllMocks();

  bookingFindUnique().mockResolvedValue(mkBooking());
  bookingUpdateMany()
    .mockResolvedValueOnce({ count: 1 }) // confirmationEmailSentAt claim
    .mockResolvedValueOnce({ count: 1 }); // internalEmailSentAt claim
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
    // Claims: customer wins, internal wins (already set in beforeEach)

    // Act
    await notifyBookingConfirmed(999, "customer");

    // Assert: two atomic claims now (customer + internal)
    expect(db.booking.updateMany).toHaveBeenCalledTimes(2);

    const first = mockCalls(db.booking.updateMany)[0][0];
    expect(first.where).toMatchObject({
      id: 999,
      confirmationEmailSentAt: null,
    });
    expect(first.data.confirmationEmailSentAt).toBeInstanceOf(Date);
    expect(first.data.invoiceEmailSentAt).toBeInstanceOf(Date);

    const second = mockCalls(db.booking.updateMany)[1][0];
    expect(second.where).toMatchObject({ id: 999, internalEmailSentAt: null });
    expect(second.data.internalEmailSentAt).toBeInstanceOf(Date);

    // Emails: one customer + one internal
    expect(buildCustomerEmail).toHaveBeenCalledTimes(1);
    expect(buildInternalEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledTimes(2);

    const tos = mockCalls(sendEmail).map((c) => c[0].to as string | string[]);
    const flat = Array.isArray(tos[0])
      ? (tos[0] as string[])
      : tos.map((x) => x as string);
    expect(flat.join(",")).toContain("jane@example.com");
  });

  it("when invoice does NOT exist yet: sends confirmation only (no invoiceEmailSentAt set)", async () => {
    // Arrange: default mkBooking has no invoice
    bookingFindUnique().mockResolvedValue(mkBooking());
    // Claims: customer wins, internal wins (from beforeEach)

    // Act
    await notifyBookingConfirmed(999, "customer");

    // Assert: first claim (customer): confirmationEmailSentAt only
    const first = mockCalls(db.booking.updateMany)[0][0];
    expect(first.data.confirmationEmailSentAt).toBeInstanceOf(Date);
    expect(
      Object.prototype.hasOwnProperty.call(first.data, "invoiceEmailSentAt")
    ).toBe(false);

    // Second claim is internal; we don't need to reassert here beyond call count
    expect(db.booking.updateMany).toHaveBeenCalledTimes(2);

    // Emails: 2 (customer + internal)
    expect(buildCustomerEmail).toHaveBeenCalledTimes(1);
    expect(buildInternalEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  it("idempotency: when customer updateMany.count=0, no customer email; internal still sent", async () => {
    // Arrange: override default claim chain for this test ONLY
    bookingUpdateMany()
      .mockReset() // 1) clear beforeEach’s two resolves
      .mockResolvedValueOnce({ count: 0 }) // 2) customer claim loses (already sent)
      .mockResolvedValueOnce({ count: 1 }); // 3) internal claim wins (send once)

    bookingFindUnique().mockResolvedValue(mkBooking());

    // Act
    await notifyBookingConfirmed(999, "customer");

    // Assert: both claims attempted
    expect(db.booking.updateMany).toHaveBeenCalledTimes(2);

    // Customer path skipped (no template/send)
    expect(buildCustomerEmail).not.toHaveBeenCalled();

    // Internal path sent exactly one email
    expect(buildInternalEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledTimes(1); // internal only
  });

  it("skips customer email for internal placeholder addresses; still sends internal", async () => {
    // Arrange: customer email is placeholder (customer path short-circuits)
    bookingFindUnique().mockResolvedValue(
      mkBooking({ customerEmail: "x@internal.local" })
    );

    // For this scenario, only the internal claim should occur; ensure a single resolve
    bookingUpdateMany()
      .mockReset() // reset chain for this test
      .mockResolvedValueOnce({ count: 1 }); // internal internalEmailSentAt claim

    // Act
    await notifyBookingConfirmed(999, "customer");

    // Assert: only one updateMany call (internal claim)
    expect(db.booking.updateMany).toHaveBeenCalledTimes(1);
    const only = mockCalls(db.booking.updateMany)[0][0];
    expect(only.where).toMatchObject({ id: 999, internalEmailSentAt: null });

    expect(buildCustomerEmail).not.toHaveBeenCalled();
    expect(buildInternalEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledTimes(1); // internal only
  });
});
