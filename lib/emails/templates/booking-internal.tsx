import "server-only";
import type { ReactElement } from "react";

export type BookingInternalProps = {
  companyName: string; // "Algarve Machinery Rental"
  adminEmail: string; // "amr.business.pt@gmail.com"
  bookingId: number;
  source: "customer" | "ops"; // Who triggered this email
  machineTitle?: string | null;
  startYmd: string; // "YYYY-MM-DD"
  endYmd: string; // "YYYY-MM-DD"
  customerName?: string | null;
  customerEmail?: string | null;
  siteAddressLine1?: string | null;
  siteAddressCity?: string | null;
  depositPaid?: boolean; // true for customer checkout confirmations
  opsUrl?: string | null; // e.g. `${APP_URL}/ops` or a deep link
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

/** Minimal inline styles for broad client support */
const styles = {
  body: {
    fontFamily:
      "ui-sans-serif, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
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
    padding: "20px",
    border: "1px solid #e5e7eb",
  },
  h1: { fontSize: "16px", margin: "0 0 12px 0" },
  p: { margin: "8px 0" },
  hr: { border: 0, borderTop: "1px solid #e5e7eb", margin: "14px 0" },
  small: { color: "#6b7280", fontSize: "12px" },
  k: { color: "#374151", minWidth: "120px", display: "inline-block" },
  v: { color: "#111827" },
  link: { color: "#111827" },
} as const;

export default function BookingInternalEmail(
  props: BookingInternalProps
): ReactElement {
  const {
    companyName,
    adminEmail,
    bookingId,
    source,
    machineTitle,
    startYmd,
    endYmd,
    customerName,
    customerEmail,
    siteAddressLine1,
    siteAddressCity,
    depositPaid,
  } = props;

  const dateRange = fmtRangeLisbon(startYmd, endYmd);

  return (
    <html>
      <body style={styles.body}>
        <div style={styles.container}>
          <div style={styles.card}>
            <h1 style={styles.h1}>{companyName}: new booking</h1>
            <p style={styles.p}>
              <span style={styles.k}>Booking ID:</span>
              <span style={styles.v}>#{bookingId}</span>
            </p>
            <p style={styles.p}>
              <span style={styles.k}>Source:</span>
              <span style={styles.v}>
                {source === "customer" ? "Customer checkout" : "Ops console"}
              </span>
            </p>
            {machineTitle ? (
              <p style={styles.p}>
                <span style={styles.k}>Machine:</span>
                <span style={styles.v}>{machineTitle}</span>
              </p>
            ) : null}
            <p style={styles.p}>
              <span style={styles.k}>Dates:</span>
              <span style={styles.v}>{dateRange} (Lisbon)</span>
            </p>
            {typeof depositPaid === "boolean" ? (
              <p style={styles.p}>
                <span style={styles.k}>Deposit paid:</span>
                <span style={styles.v}>{depositPaid ? "Yes" : "No"}</span>
              </p>
            ) : null}
            {customerName ? (
              <p style={styles.p}>
                <span style={styles.k}>Customer:</span>
                <span style={styles.v}>{customerName}</span>
              </p>
            ) : null}
            {customerEmail ? (
              <p style={styles.p}>
                <span style={styles.k}>Email:</span>
                <span style={styles.v}>{customerEmail}</span>
              </p>
            ) : null}
            {siteAddressLine1 ? (
              <p style={styles.p}>
                <span style={styles.k}>Site address:</span>
                <span style={styles.v}>
                  {siteAddressLine1}
                  {siteAddressCity ? `, ${siteAddressCity}` : ""}
                </span>
              </p>
            ) : null}

            <hr style={styles.hr} />
            <p style={styles.small}>
              Internal notification for {companyName}. Replies go to{" "}
              {adminEmail}.
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
