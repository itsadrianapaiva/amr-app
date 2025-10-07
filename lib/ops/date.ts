import "server-only";

/** Add N days without mutating the original date. */
export function addDays(d: Date, n: number) {
  const copy = new Date(d.getTime());
  copy.setDate(copy.getDate() + n);
  return copy;
}

/** Format a YYYY-MM-DD string as DD-MM-YYYY for PT display. */
export function toPt(dateYmd: string): string {
  const [y, m, d] = dateYmd.split("-");
  return `${d}-${m}-${y}`;
}

/** Get today's YYYY-MM-DD in Lisbon for stable links/UI. */
export function todayYmdLisbon(): string {
  const [dd, mm, yyyy] = new Date()
    .toLocaleDateString("en-GB", {
      timeZone: "Europe/Lisbon",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .split("/");
  return `${yyyy}-${mm}-${dd}`;
}

/** Parse YYYY-MM-DD to a Date anchored at 12:00 UTC (avoids TZ edge bugs). */
export function fromYmdAtNoonUTC(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]) - 1, d = Number(m[3]);
  return new Date(Date.UTC(y, mo, d, 12, 0, 0)); // noon UTC anchor
}

/** Clamp integer to [min,max], with a fallback when NaN. */
export function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "string" ? parseInt(v, 10) : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
