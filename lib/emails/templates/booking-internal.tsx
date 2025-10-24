import "server-only";
import type { ReactElement, ReactNode } from "react";

/** Ops-facing fast-facts template. Money as strings "123.45". */
export type BookingInternalEmailProps = {
  companyName: string;
  adminEmail: string; // replies go here

  source: "customer" | "ops"; // who created it

  bookingId: number;

  machineId: number;
  machineName: string;

  startYmd: string; // "YYYY-MM-DD"
  endYmd: string; // "YYYY-MM-DD"
  rentalDays: number;

  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;

  siteAddress?: string | null;
  addonsList?: string | null;

  // explicit fulfilment flags (optional so existing callers don't break)
  /** Delivery = AMR delivers to customer at START */
  deliverySelected?: boolean;
  /** Pickup = AMR collects from customer at END */
  pickupSelected?: boolean;

  heavyLeadTimeApplies: boolean;
  geofenceStatus: "inside" | "outside" | "edge";

  subtotalExVat: string;
  vatAmount: string;
  totalInclVat: string;
  depositAmount: string;

  // Discount (optional) - from persisted cents values
  discountPercentage?: number;
  discountAmountExVat?: string;
  discountedSubtotalExVat?: string;
  partnerCompanyName?: string;
  partnerNif?: string;

  opsUrlForBooking: string;
  stripePiId?: string | null;
  stripePiUrl?: string | null;

  invoiceNumber?: string | null;
  invoicePdfUrl?: string | null;

  googleCalendarEventId?: string | null;
  googleHtmlLink?: string | null;
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

/** Inline styles: robust across mail clients (ASCII-only to avoid parser issues) */
const S = {
  body: {
    // Single-line ASCII string; quote Segoe UI explicitly for safety
    fontFamily:
      'ui-sans-serif, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
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
  h1: { fontSize: "16px", margin: "0 0 12px 0" },
  p: { margin: "8px 0" },
  k: { color: "#374151", minWidth: "132px", display: "inline-block" },
  v: { color: "#111827" },
  hr: { border: 0, borderTop: "1px solid #e5e7eb", margin: "14px 0" },
  small: { color: "#6b7280", fontSize: "12px" },
  link: { color: "#111827" },
} as const;

/** Accept ReactNode so we can pass strings OR <a> links without casts. */
function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <p style={S.p}>
      <span style={S.k}>{k}</span>
      <span style={S.v}>{v}</span>
    </p>
  );
}

export default function BookingInternalEmail(
  props: BookingInternalEmailProps
): ReactElement {
  const {
    companyName,
    adminEmail,
    source,
    bookingId,
    machineId,
    machineName,
    startYmd,
    endYmd,
    rentalDays,
    customerName,
    customerEmail,
    customerPhone,
    siteAddress,
    addonsList,
    // NEW flags
    deliverySelected,
    pickupSelected,
    heavyLeadTimeApplies,
    geofenceStatus,
    subtotalExVat,
    vatAmount,
    totalInclVat,
    depositAmount,
    discountPercentage,
    discountAmountExVat,
    discountedSubtotalExVat,
    partnerCompanyName,
    partnerNif,
    opsUrlForBooking,
    stripePiId,
    stripePiUrl,
    invoiceNumber,
    invoicePdfUrl,
    googleCalendarEventId,
    googleHtmlLink,
  } = props;

  const dateRange = fmtRangeLisbon(startYmd, endYmd);

  // Derive human strings for fulfilment (fallback to "—" if unknown)
  const startLogistics =
    deliverySelected === true
      ? "Deliver to site"
      : deliverySelected === false
        ? "Customer collects at warehouse"
        : "—";

  const endLogistics =
    pickupSelected === true
      ? "Pickup from site"
      : pickupSelected === false
        ? "Customer returns to warehouse"
        : "—";

  return (
    <html>
      <body style={S.body}>
        <div style={S.container}>
          <div style={S.card}>
            <h1 style={S.h1}>New confirmed booking</h1>

            <Row k="Booking #:" v={`#${bookingId}`} />
            <Row
              k="Source:"
              v={source === "customer" ? "Customer checkout" : "Ops console"}
            />

            <Row k="Machine:" v={`${machineName} (id ${machineId})`} />
            <Row k="Dates:" v={`${dateRange} (Lisbon) • ${rentalDays}d`} />

            <Row
              k="Customer:"
              v={[
                customerName || "—",
                customerPhone ? ` · ${customerPhone}` : "",
                customerEmail ? ` · ${customerEmail}` : "",
              ].join("")}
            />

            <Row k="Address:" v={siteAddress || "—"} />
            <Row k="Add-ons:" v={addonsList || "None"} />

            {/* NEW: explicit logistics for start and end of rental */}
            <Row k="Start logistics:" v={startLogistics} />
            <Row k="End logistics:" v={endLogistics} />

            <Row k="Lead-time:" v={heavyLeadTimeApplies ? "Applies" : "N/A"} />
            <Row k="Geofence:" v={geofenceStatus} />

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
            <Row k="Deposit at handover:" v={euro(depositAmount)} />

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

            {invoiceNumber ? (
              <Row
                k="Invoice:"
                v={
                  invoicePdfUrl ? (
                    <a href={invoicePdfUrl} style={S.link}>
                      {invoiceNumber} · PDF
                    </a>
                  ) : (
                    invoiceNumber
                  )
                }
              />
            ) : (
              <Row k="Invoice:" v="No invoice yet (async or retry pending)" />
            )}

            <Row
              k="Ops:"
              v={
                <a href={opsUrlForBooking} style={S.link}>
                  Open booking
                </a>
              }
            />

            {stripePiUrl || stripePiId ? (
              <Row
                k="Stripe:"
                v={
                  stripePiUrl ? (
                    <a href={stripePiUrl} style={S.link}>
                      PaymentIntent
                    </a>
                  ) : (
                    `PI ${stripePiId}`
                  )
                }
              />
            ) : null}

            {googleCalendarEventId ? (
              <Row
                k="Calendar:"
                v={
                  googleHtmlLink ? (
                    <a href={googleHtmlLink} style={S.link}>
                      Event
                    </a>
                  ) : (
                    googleCalendarEventId
                  )
                }
              />
            ) : null}

            <hr style={S.hr} />
            <p style={S.small}>
              Internal notification for {companyName}. Replies go to{" "}
              {adminEmail}.
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
