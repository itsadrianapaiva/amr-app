import "server-only";
import type { ReactElement } from "react";
import { buildInvoiceLinkSnippet } from "@/lib/emails/invoice-link";

/** Props aligned to our customer-facing data contract. Money as strings "123.45". */
export type CustomerBookingEmailProps = {
  companyName: string;
  companyEmail: string; // shown in footer
  supportPhone: string; // "Need help?" section
  companySite: string; // e.g., https://amr.pt

  customerName?: string | null;
  bookingId: number;

  machineName: string;
  startYmd: string; // "YYYY-MM-DD"
  endYmd: string; // "YYYY-MM-DD"
  rentalDays: number;
  addonsList?: string | null;

  deliverySelected: boolean;
  pickupSelected: boolean;

  siteAddress?: string | null; // single-line address for simplicity

  subtotalExVat: string; // "123.45" - original OR discounted if no discount data
  vatAmount: string; // "28.34"
  totalInclVat: string; // "151.79"
  depositAmount: string; // "350.00"

  // Discount (optional) - from persisted cents values
  discountPercentage?: number; // 10
  discountAmountExVat?: string; // "10.00" (ex VAT)
  discountedSubtotalExVat?: string; // "90.00" (after discount, ex VAT)
  partnerCompanyName?: string; // "Acme Corp"
  partnerNif?: string; // "123456789"

  invoicePdfUrl?: string | null;

  warehouseAddress: string;
  warehouseHours: string; // "Mon–Fri 09:00–17:00"
  callByDateTimeLocal?: string | null; // "Sep 13, 18:00 Lisbon"
  machineAccessNote?: string | null; // "3.5-ton truck"
};

/** Helpers */
function ymdToUtc(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function fmtLisbon(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Lisbon",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}
function fmtRangeLisbon(aYmd: string, bYmd: string): string {
  const a = fmtLisbon(ymdToUtc(aYmd));
  const b = fmtLisbon(ymdToUtc(bYmd));
  return a === b ? a : `${a} to ${b}`;
}
const euro = (n: string) => `€${n}`;

/** Minimal inline styles for wide email client support */
const S = {
  body: {
    fontFamily:
      "ui-sans-serif, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
    margin: 0,
    padding: 0,
    backgroundColor: "#f6f7f9",
    color: "#111827",
  },
  container: { maxWidth: "560px", margin: "0 auto", padding: "24px 16px" },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: "12px",
    padding: "20px",
    border: "1px solid #e5e7eb",
  },
  h1: { fontSize: "18px", margin: "0 0 12px 0" },
  p: { margin: "8px 0" },
  k: { color: "#374151", minWidth: "132px", display: "inline-block" },
  v: { color: "#111827" },
  hr: { border: 0, borderTop: "1px solid #e5e7eb", margin: "14px 0" },
  small: { color: "#6b7280", fontSize: "12px" },
  link: { color: "#111827" },
} as const;

function Row({ k, v }: { k: string; v: string }) {
  return (
    <p style={S.p}>
      <span style={S.k}>{k}</span>
      <span style={S.v}>{v}</span>
    </p>
  );
}

export default async function BookingConfirmedEmail(
  props: CustomerBookingEmailProps
): Promise<ReactElement> {
  const {
    companyName,
    companyEmail,
    supportPhone,
    companySite,

    customerName,
    bookingId,

    machineName,
    startYmd,
    endYmd,
    rentalDays,
    addonsList,

    deliverySelected,
    pickupSelected,

    siteAddress,

    subtotalExVat,
    vatAmount,
    totalInclVat,
    depositAmount,

    discountPercentage,
    discountAmountExVat,
    discountedSubtotalExVat,
    partnerCompanyName,
    partnerNif,

    invoicePdfUrl,

    warehouseAddress,
    warehouseHours,
    callByDateTimeLocal,
    machineAccessNote,
  } = props;

  const dateRange = fmtRangeLisbon(startYmd, endYmd);
  const greeting = customerName ? `Hi ${customerName},` : "Hello,";

  // Prefer our signed proxy link when an invoice exists; fall back to raw URL if env is missing.
  let invoiceHref: string | null = null;
  if (invoicePdfUrl) {
    try {
      invoiceHref = (await buildInvoiceLinkSnippet(bookingId)).url; // default TTL 72h
    } catch {
      invoiceHref = invoicePdfUrl; // safe fallback
    }
  }

  return (
    <html>
      <body style={S.body}>
        <div style={S.container}>
          <div style={S.card}>
            <h1 style={S.h1}>Your AMR booking is confirmed</h1>
            <p style={S.p}>{greeting}</p>
            <p style={S.p}>
              We have received your payment. Here is a quick summary and what
              happens next.
            </p>

            <hr style={S.hr} />

            <Row k="Booking #:" v={`#${bookingId}`} />
            <Row k="Machine:" v={machineName} />
            <Row k="Dates:" v={`${dateRange} (Lisbon)`} />
            <Row
              k="Days:"
              v={`${rentalDays} day${rentalDays === 1 ? "" : "s"}`}
            />
            <Row k="Add-ons:" v={addonsList || "None"} />
            {siteAddress ? <Row k="Service address:" v={siteAddress} /> : null}

            <hr style={S.hr} />

            {discountPercentage &&
            discountPercentage > 0 &&
            discountAmountExVat &&
            discountedSubtotalExVat ? (
              <>
                <Row k="Subtotal (ex VAT):" v={euro(subtotalExVat)} />
                <Row
                  k={`Discount (${discountPercentage}%):`}
                  v={`-${euro(discountAmountExVat)}`}
                />
                <Row
                  k="After discount (ex VAT):"
                  v={euro(discountedSubtotalExVat)}
                />
              </>
            ) : (
              <Row k="Subtotal (ex VAT):" v={euro(subtotalExVat)} />
            )}
            <Row k="VAT (23%):" v={euro(vatAmount)} />
            <p style={S.p}>
              <span style={S.k}>
                <strong>Total paid (incl. VAT):</strong>
              </span>
              <span style={S.v}>
                <strong>{euro(totalInclVat)}</strong>
              </span>
            </p>
            <Row k="Refundable deposit at handover:" v={euro(depositAmount)} />

            {/* Partner discount disclosure */}
            {discountPercentage &&
              discountPercentage > 0 &&
              (partnerCompanyName || partnerNif) && (
                <>
                  <hr style={S.hr} />
                  <p style={{ ...S.p, ...S.small }}>
                    <strong>Partner discount:</strong> {discountPercentage}%
                    {partnerCompanyName && ` • Company: ${partnerCompanyName}`}
                    {partnerNif && ` • NIF: ${partnerNif}`}
                  </p>
                </>
              )}

            <hr style={S.hr} />

            {/* Clear logistics: start vs end of rental */}
            <p style={S.p}>
              <strong>Start of rental:</strong>{" "}
              {deliverySelected ? (
                <>
                  We will deliver the machine to your site.
                  {callByDateTimeLocal
                    ? ` We will call you by ${callByDateTimeLocal}`
                    : " We will call you"}{" "}
                  to confirm the delivery window. Please ensure access is clear
                  {machineAccessNote ? ` for a ${machineAccessNote}` : ""}.
                </>
              ) : (
                <>
                  Please collect the machine at{" "}
                  <span style={S.v}>{warehouseAddress}</span>. Hours:{" "}
                  <span style={S.v}>{warehouseHours}</span>. Bring a valid ID
                  and this email.
                </>
              )}
            </p>

            <p style={S.p}>
              <strong>End of rental:</strong>{" "}
              {pickupSelected ? (
                <>
                  We will pick up the machine from your site on your end date.
                  We will contact you to schedule the pickup window.
                </>
              ) : (
                <>
                  Please return the machine to{" "}
                  <span style={S.v}>{warehouseAddress}</span>. Hours:{" "}
                  <span style={S.v}>{warehouseHours}</span>. If you prefer a
                  pickup, reply to this email and we will arrange it.
                </>
              )}
            </p>

            <p style={S.p}>
              <strong>On handover:</strong> We collect the refundable deposit,
              do a short equipment check on return, and release the deposit
              after inspection.
            </p>

            <hr style={S.hr} />

            {invoiceHref ? (
              <p style={S.p}>
                <strong>Invoice:</strong>{" "}
                <a href={invoiceHref} style={S.link}>
                  Download PDF
                </a>
              </p>
            ) : (
              <p style={S.p}>
                <strong>Invoice:</strong> It will arrive shortly after payment
                is fully settled.
              </p>
            )}

            <p style={S.small}>
              Need help? Call {supportPhone} or reply to this email.{" "}
              {companyName} ·{" "}
              <a href={companySite} style={S.link}>
                {companySite}
              </a>{" "}
              · {companyEmail}
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
