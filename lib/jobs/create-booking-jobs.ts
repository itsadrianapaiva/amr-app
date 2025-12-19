// Idempotent job creation for booking-related side effects

import { db } from "@/lib/db";
import type { BookingJobType } from "./booking-job-types";
import type { LogFn } from "@/lib/stripe/webhook-service";

/** Job creation input */
export interface CreateJobInput {
  type: BookingJobType;
  payload?: Record<string, unknown>;
}

/** Default no-op logger */
const defaultLog: LogFn = () => {};

/**
 * Create jobs for a booking (idempotent via unique constraint on bookingId+type).
 * Uses upsert pattern to safely handle concurrent job creation attempts.
 */
export async function createBookingJobs(
  bookingId: number,
  jobs: CreateJobInput[],
  log: LogFn = defaultLog
): Promise<void> {
  // Create each job idempotently using upsert
  // The @@unique([bookingId, type]) constraint ensures only one job per (bookingId, type)
  for (const job of jobs) {
    try {
      const created = await db.bookingJob.upsert({
        where: {
          bookingId_type: {
            bookingId,
            type: job.type,
          },
        },
        update: {
          // If job exists and failed, reset to pending for retry
          // If job is pending/processing/completed, leave it unchanged
          status: "pending",
          attempts: 0,
          updatedAt: new Date(),
        },
        create: {
          bookingId,
          type: job.type,
          status: "pending",
          payload: job.payload ?? {},
          attempts: 0,
        },
      });

      log("job:created", {
        jobId: created.id,
        bookingId,
        type: job.type,
        isNew: created.createdAt.getTime() === created.updatedAt.getTime(),
      });
    } catch (err) {
      // Log but don't throw - job creation failure shouldn't block webhook ACK
      log("job:create_error", {
        bookingId,
        type: job.type,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
