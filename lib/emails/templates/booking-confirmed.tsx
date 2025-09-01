import "server-only";
import type { ReactElement } from "react";

/** Props kept minimal so we can call this from both webhook and ops flows */
export type BookingConfirmedProps = {
    companyName: string;                   // "Algarve Machinery Rental"
    supportEmail: string;                  // "amr.business.pt@gmail.com"
    customerName?: string | null;          // Optional personalization
    bookingId: number;
    machineTitle?: string | null;          // e.g. "Mini Excavator CAT 301.7"
    startYmd: string;                      // "YYYY-MM-DD"
    endYmd: string;                        // "YYYY-MM-DD"
    depositPaidEuros?: number | null;      // Optional for customer clarity
    siteAddressLine1?: string | null;
    siteAddressCity?: string | null;
  };

  /** Convert YYYY-MM-DD to Date at midnight UTC */
function ymdToUtc(ymd: string): Date {
    const [y, m, d] = ymd.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }
  
  /** Format a Date in Lisbon as "26 Sep 2025" */
  function fmtLisbon(d: Date): string {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Lisbon",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(d);
  }

  /** Join a date range, collapsing when start == end */
function fmtRangeLisbon(startYmd: string, endYmd: string): string {
    const a = ymdToUtc(startYmd);
    const b = ymdToUtc(endYmd);
    const aStr = fmtLisbon(a);
    const bStr = fmtLisbon(b);
    return aStr === bStr ? aStr : `${aStr} to ${bStr}`;
  }

  /** Inline styles for broad client support */
const styles = {
    body: {
      fontFamily: 'ui-sans-serif, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
      margin: 0,
      padding: 0,
      backgroundColor: "#f6f7f9",
      color: "#111827",
    },
    container: {
      maxWidth: "560px",
      margin: "0 auto",
      padding: "24px 16px",
    },
    card: {
      backgroundColor: "#ffffff",
      borderRadius: "12px",
      padding: "24px",
      border: "1px solid #e5e7eb",
    },
    h1: { fontSize: "18px", margin: "0 0 12px 0" },
    p: { margin: "8px 0" },
    hr: { border: 0, borderTop: "1px solid #e5e7eb", margin: "16px 0" },
    small: { color: "#6b7280", fontSize: "12px" },
    strong: { fontWeight: 600 },
    btn: {
      display: "inline-block",
      padding: "10px 16px",
      borderRadius: "8px",
      textDecoration: "none",
      backgroundColor: "#111827",
      color: "#ffffff",
    },
  } as const;
  
  export default function BookingConfirmedEmail(props: BookingConfirmedProps): ReactElement {
    const {
      companyName,
      supportEmail,
      bookingId,
      customerName,
      machineTitle,
      startYmd,
      endYmd,
      depositPaidEuros,
      siteAddressLine1,
      siteAddressCity,
    } = props;

    const dateRange = fmtRangeLisbon(startYmd, endYmd);
  const greeting = customerName ? `Hi ${customerName},` : "Hello,";

  return (
    <html>
      <body style={styles.body}>
        <div style={styles.container}>
          <div style={styles.card}>
            <h1 style={styles.h1}>Your booking is confirmed</h1>
            <p style={styles.p}>{greeting}</p>
            <p style={styles.p}>
              We have received your deposit and confirmed your booking.
            </p>

            <hr style={styles.hr} />

            <p style={styles.p}>
              <span style={styles.strong}>Booking ID:</span> #{bookingId}
            </p>
            {machineTitle ? (
              <p style={styles.p}>
                <span style={styles.strong}>Machine:</span> {machineTitle}
              </p>
            ) : null}
            <p style={styles.p}>
              <span style={styles.strong}>Dates:</span> {dateRange} (Lisbon)
            </p>
            {typeof depositPaidEuros === "number" ? (
              <p style={styles.p}>
                <span style={styles.strong}>Deposit paid:</span> €{depositPaidEuros.toFixed(2)}
              </p>
            ) : null}
            {siteAddressLine1 ? (
              <p style={styles.p}>
                <span style={styles.strong}>Site address:</span>{" "}
                {siteAddressLine1}
                {siteAddressCity ? `, ${siteAddressCity}` : ""}
              </p>
            ) : null}

            <p style={{ ...styles.p, marginTop: "16px" }}>
              We will contact you to confirm delivery or pickup details. If you have
              any questions, reply to this email and our team will help.
            </p>

            <hr style={styles.hr} />

            <p style={styles.small}>
              {companyName}. For support contact {supportEmail}.
            </p>
            <p style={styles.small}>
              This message was sent automatically. Please keep your booking ID for reference.
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}