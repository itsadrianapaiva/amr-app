// Job type definitions for BookingJob queue

/** Supported job types */
export type BookingJobType =
  | "issue_invoice"
  | "send_customer_confirmation"
  | "send_internal_confirmation"
  | "send_invoice_ready";

/** Job status lifecycle */
export type BookingJobStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

/** Validate job type at runtime */
export function isValidJobType(type: unknown): type is BookingJobType {
  return (
    typeof type === "string" &&
    [
      "issue_invoice",
      "send_customer_confirmation",
      "send_internal_confirmation",
      "send_invoice_ready",
    ].includes(type)
  );
}

/** Validate job status at runtime */
export function isValidJobStatus(status: unknown): status is BookingJobStatus {
  return (
    typeof status === "string" &&
    ["pending", "processing", "completed", "failed"].includes(status)
  );
}
