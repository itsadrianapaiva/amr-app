// Durable job processor for booking-related side effects

import { db } from "@/lib/db";
import type { BookingJobType } from "./booking-job-types";
import { notifyBookingConfirmed } from "@/lib/notifications/notify-booking-confirmed";
import { notifyInvoiceReady } from "@/lib/notifications/notify-invoice-ready";
import {
  maybeIssueInvoice,
  type BookingFacts,
} from "@/lib/invoicing/issue-for-booking";

/** Job processor options */
export interface ProcessJobsOptions {
  limit?: number;
}

/** Job processor result */
export interface ProcessJobsResult {
  processed: number;
  remainingPending: number;
}

/**
 * Process pending booking jobs (atomic claim + execute + update status).
 * Designed to be called by cron every 1 minute.
 */
export async function processBookingJobs(
  opts: ProcessJobsOptions = {}
): Promise<ProcessJobsResult> {
  const limit = opts.limit ?? 10;

  // Fetch oldest pending jobs
  const jobs = await db.bookingJob.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let processed = 0;

  for (const job of jobs) {
    const startTime = Date.now();

    // Atomic claim: update status to "processing" only if still pending
    const claimed = await db.bookingJob.updateMany({
      where: {
        id: job.id,
        status: "pending",
      },
      data: {
        status: "processing",
        updatedAt: new Date(),
      },
    });

    if (claimed.count === 0) {
      // Another worker claimed this job
      continue;
    }

    // Log job processing start
    console.log(
      JSON.stringify({
        event: "job:processing",
        jobId: job.id,
        bookingId: job.bookingId,
        type: job.type,
        attempt: job.attempts + 1,
      })
    );

    try {
      // Execute the job
      await executeJob(job.bookingId, job.type as BookingJobType, job.payload);

      // Mark as completed
      await db.bookingJob.update({
        where: { id: job.id },
        data: {
          status: "completed",
          processedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const durationMs = Date.now() - startTime;
      console.log(
        JSON.stringify({
          event: "job:completed",
          jobId: job.id,
          bookingId: job.bookingId,
          type: job.type,
          durationMs,
        })
      );

      processed++;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const newAttempts = job.attempts + 1;
      const isFailed = newAttempts >= job.maxAttempts;

      // Update job with error info
      await db.bookingJob.update({
        where: { id: job.id },
        data: {
          status: isFailed ? "failed" : "pending",
          attempts: newAttempts,
          result: { error: errorMessage, attemptedAt: new Date().toISOString() },
          updatedAt: new Date(),
        },
      });

      console.log(
        JSON.stringify({
          event: "job:failed",
          jobId: job.id,
          bookingId: job.bookingId,
          type: job.type,
          attempt: newAttempts,
          error: errorMessage,
          willRetry: !isFailed,
        })
      );
    }
  }

  // Count remaining pending jobs
  const remainingPending = await db.bookingJob.count({
    where: { status: "pending" },
  });

  return { processed, remainingPending };
}

/**
 * Execute a single job based on type.
 * Throws on error to trigger retry logic.
 */
async function executeJob(
  bookingId: number,
  type: BookingJobType,
  payload: any
): Promise<void> {
  switch (type) {
    case "issue_invoice":
      await executeIssueInvoice(bookingId, payload);
      break;
    case "send_customer_confirmation":
      await notifyBookingConfirmed(bookingId, "customer");
      break;
    case "send_internal_confirmation":
      await notifyBookingConfirmed(bookingId, "ops");
      break;
    case "send_invoice_ready":
      await notifyInvoiceReady(bookingId);
      break;
    default:
      throw new Error(`Unknown job type: ${type}`);
  }
}

/**
 * Issue invoice for a booking and persist invoice fields.
 */
async function executeIssueInvoice(
  bookingId: number,
  payload: any
): Promise<void> {
  const stripePaymentIntentId = payload?.stripePaymentIntentId as
    | string
    | undefined;

  if (!stripePaymentIntentId) {
    throw new Error("Missing stripePaymentIntentId in payload");
  }

  // Fetch booking facts
  const facts = await fetchBookingFacts(bookingId);

  // Issue invoice via Vendus (feature-flagged)
  const record = await maybeIssueInvoice({
    booking: facts,
    stripePaymentIntentId,
    paidAt: new Date(),
    notes: undefined,
  });

  if (record) {
    // Persist invoice fields to Booking
    await db.booking.update({
      where: { id: bookingId },
      data: {
        invoiceProvider: record.provider,
        invoiceProviderId: record.providerInvoiceId,
        invoiceNumber: record.number,
        invoicePdfUrl: record.pdfUrl,
        invoiceAtcud: record.atcud ?? null,
        updatedAt: new Date(),
      },
    });

    console.log(
      JSON.stringify({
        event: "invoice:issued",
        bookingId,
        provider: record.provider,
        number: record.number,
      })
    );

    // Create follow-up job to send invoice-ready email
    await db.bookingJob.upsert({
      where: {
        bookingId_type: {
          bookingId,
          type: "send_invoice_ready",
        },
      },
      update: {
        status: "pending",
        attempts: 0,
      },
      create: {
        bookingId,
        type: "send_invoice_ready",
        status: "pending",
        payload: {},
      },
    });
  } else {
    console.log(
      JSON.stringify({
        event: "invoice:skipped",
        bookingId,
        reason: "INVOICING_ENABLED=false or feature disabled",
      })
    );
  }
}

/**
 * Fetch booking facts for invoice issuance.
 * Reuses logic from webhook handlers.
 */
async function fetchBookingFacts(bookingId: number): Promise<BookingFacts> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      machine: { select: { name: true, dailyRate: true } },
    },
  });

  if (!booking) {
    throw new Error(`Booking ${bookingId} not found`);
  }
  if (!booking.machine) {
    throw new Error(`Booking ${bookingId} has no machine relation`);
  }

  const unitDailyCents = decimalToCents(booking.machine.dailyRate);

  const nif =
    (booking.billingIsBusiness ? booking.billingTaxId : undefined) ??
    booking.customerNIF ??
    undefined;

  // Determine billing address (business vs individual with NIF)
  let billingAddress: BookingFacts["billing"];

  if (booking.billingIsBusiness) {
    billingAddress = {
      line1: booking.billingAddressLine1 ?? undefined,
      city: booking.billingCity ?? undefined,
      postalCode: booking.billingPostalCode ?? undefined,
      country: (booking.billingCountry as any) ?? "PT",
    };
  } else if (
    nif &&
    (booking.siteAddressLine1 ||
      booking.siteAddressCity ||
      booking.siteAddressPostalCode)
  ) {
    billingAddress = {
      line1: booking.siteAddressLine1 ?? undefined,
      city: booking.siteAddressCity ?? undefined,
      postalCode: booking.siteAddressPostalCode ?? undefined,
      country: "PT",
    };
  } else {
    billingAddress = undefined;
  }

  return {
    id: booking.id,
    startDate: booking.startDate,
    endDate: booking.endDate,
    machineName: booking.machine.name,
    unitDailyCents,
    vatPercent: 23,

    customerName: booking.customerName,
    customerEmail: booking.customerEmail ?? undefined,
    customerNIF: nif,

    billing: billingAddress,
  };
}

/** Prisma Decimal-safe cents conversion */
function decimalToCents(value: unknown): number {
  const n =
    typeof value === "number"
      ? value
      : (value as any)?.toNumber
        ? (value as any).toNumber()
        : Number(value);
  return Math.round(n * 100);
}
