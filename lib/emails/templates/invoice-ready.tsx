import type { ReactElement } from "react";

/** Subject helper so callers don’t duplicate string logic. */
export function subjectForInvoiceReady(
  bookingId: number,
  invoiceNumber?: string
): string {
  return invoiceNumber
    ? `Your AMR invoice ${invoiceNumber} for booking #${bookingId}`
    : `Your AMR invoice for booking #${bookingId}`;
}

export default function InvoiceReadyEmail(props: {
  companyName: string;
  supportEmail: string;
  supportPhone: string;

  customerName?: string;
  bookingId: number;
  invoiceNumber?: string;
  invoiceUrl: string; // signed proxy URL
}): ReactElement {
  const greeting = props.customerName ? `Hi ${props.customerName},` : "Hello,";
  return (
    <div>
      {/* Header */}
      <p>{greeting}</p>

      {/* Body */}
      <p>
        Your invoice for booking #{props.bookingId}
        {props.invoiceNumber ? ` (${props.invoiceNumber})` : ""} is ready.
      </p>
      <p>
        Download your invoice PDF here:{" "}
        <a href={props.invoiceUrl}>{props.invoiceUrl}</a>
      </p>

      {/* Footer */}
      <hr />
      <p>
        {props.companyName} • Questions? {props.supportEmail} ·{" "}
        {props.supportPhone}
      </p>
    </div>
  );
}
