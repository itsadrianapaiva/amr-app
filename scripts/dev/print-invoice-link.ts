/**
 * Prints a signed "Download invoice" URL for a given booking id.
 * Run:  pnpm tsx scripts/dev/print-invoice-link.ts <bookingId> [ttlSeconds]
 */

import "dotenv/config";
import { db } from "@/lib/db";
import { createSignedToken } from "@/lib/security/signed-links"; // <-- use the correct export

function baseUrl(): string {
  const u =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.URL ||
    "http://localhost:8888";
  return u.replace(/\/+$/, "");
}

function ttlSecondsArg(): number {
  // Priority: CLI arg → env → default 3 days
  const cli = Number(process.argv[3]);
  if (Number.isFinite(cli) && cli > 0) return cli;
  const envTtl = Number(process.env.INVOICE_LINK_TTL_SECONDS);
  if (Number.isFinite(envTtl) && envTtl > 0) return envTtl;
  return 3 * 24 * 60 * 60; // 3 days
}

async function main() {
  const bid = Number(process.argv[2]);
  if (!Number.isFinite(bid)) {
    console.error("Usage: pnpm tsx scripts/dev/print-invoice-link.ts <bookingId> [ttlSeconds]");
    process.exit(1);
  }

  const booking = await db.booking.findUnique({
    where: { id: bid },
    select: {
      id: true,
      invoiceProvider: true,
      invoiceProviderId: true,
      invoicePdfUrl: true,
      invoiceNumber: true,
    },
  });

  if (!booking) {
    console.error(`Booking ${bid} not found`);
    process.exit(2);
  }

  const ttl = ttlSecondsArg();
  const token = createSignedToken<{ bid: number }>({ bid }, ttl);
  const url = `${baseUrl()}/api/invoices/${bid}/pdf?t=${encodeURIComponent(token)}`;

  console.log("Booking snapshot:", booking);
  console.log("TTL (seconds):", ttl);
  console.log("Signed link:");
  console.log(url);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
