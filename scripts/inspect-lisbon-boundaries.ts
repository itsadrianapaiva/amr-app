/**
 * Prints recent bookings showing start/end in UTC and in Europe/Lisbon wall-time.
 * Usage:
 *   npx tsx scripts/inspect-lisbon-boundaries.ts [machineId?]
 */

import { db } from "@/lib/db";

const LISBON_TZ = "Europe/Lisbon";

function fmtInTz(date: Date, tz: string) {
  // Build YYYY-MM-DDTHH:mm:ss in the target TZ using Intl (no new deps).
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "??";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;
}

function ymdInTz(date: Date, tz: string) {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return dtf.format(date); // YYYY-MM-DD
}

async function main() {
  const argMid = process.argv[2] ? Number(process.argv[2]) : undefined;

  const where = argMid ? { machineId: argMid } : {};
  const rows = await db.booking.findMany({
    where,
    orderBy: { id: "desc" },
    take: 5,
    select: {
      id: true,
      machineId: true,
      status: true,
      startDate: true,
      endDate: true,
      customerName: true,
    },
  });

  if (!rows.length) {
    console.log("No bookings found.");
    return;
  }

  for (const r of rows) {
    const startUtcIso = r.startDate.toISOString();
    const endUtcIso = r.endDate.toISOString();
    const startLisbon = fmtInTz(r.startDate, LISBON_TZ);
    const endLisbon = fmtInTz(r.endDate, LISBON_TZ);
    const startYmdLis = ymdInTz(r.startDate, LISBON_TZ);
    const endYmdLis = ymdInTz(r.endDate, LISBON_TZ);

    console.log(
      [
        `#${r.id} M${r.machineId} ${r.status}`,
        `UTC   : ${startUtcIso} → ${endUtcIso}`,
        `Lisbon: ${startLisbon} → ${endLisbon}`,
        `Days  : ${startYmdLis} → ${endYmdLis} (inclusive?)`,
        `Name  : ${r.customerName}`,
      ].join("\n")
    );
    console.log("—".repeat(60));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
