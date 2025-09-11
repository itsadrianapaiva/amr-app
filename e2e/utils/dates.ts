/**
 * Lisbon-safe date helpers for E2E tests.
 * Goals:
 * - Produce stable YYYY-MM-DD strings (YMD) based on Europe/Lisbon time.
 * - Simple day math using UTC to avoid DST drift in CI.
 * - Compute earliest start date with a Lisbon cutoff hour.
 */

/** Format a JS Date into YYYY-MM-DD for Europe/Lisbon local date. */
export function ymdFromDateLisbon(date: Date): string {
    // Use Intl to get the local Lisbon calendar date, then rebuild a canonical YMD.
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Lisbon",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
  
    const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return `${map.year}-${map.month}-${map.day}`; // YYYY-MM-DD
  }
  
  /** Today's YYYY-MM-DD in Europe/Lisbon. */
  export function todayYmdLisbon(now: Date = new Date()): string {
    return ymdFromDateLisbon(now);
  }
  
  /** Parse "YYYY-MM-DD" into numeric parts. */
  export function parseYmd(ymd: string): { y: number; m: number; d: number } {
    const [y, m, d] = ymd.split("-").map(Number);
    if (!y || !m || !d) throw new Error(`Invalid YMD: ${ymd}`);
    return { y, m, d };
  }
  
  /** Add N days to a YMD string using UTC math and return YMD. */
  export function addDaysYmd(ymd: string, days: number): string {
    const { y, m, d } = parseYmd(ymd);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + days);
    const yyyy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(dt.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  
  /** Returns the integer hour [0..23] of "now" in Europe/Lisbon. */
  export function lisbonHour(now: Date = new Date()): number {
    const hourStr = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Lisbon",
      hour: "2-digit",
      hour12: false,
    }).format(now);
    return parseInt(hourStr, 10);
  }
  
  /**
   * Compute earliest start YMD given:
   * - leadDays: base lead time in days (e.g., 2 for heavy machines).
   * - cutoffHourLisbon: hour-of-day in Lisbon after which we slide by +1 day.
   * Rule: earliest = today + leadDays (+1 more if current Lisbon hour >= cutoff).
   */
  export function computeEarliestStartYmd(
    now: Date,
    leadDays: number,
    cutoffHourLisbon = 15
  ): string {
    const today = todayYmdLisbon(now);
    const base = addDaysYmd(today, leadDays);
    const afterCutoff = lisbonHour(now) >= cutoffHourLisbon;
    return afterCutoff ? addDaysYmd(base, 1) : base;
  }
  
  /** Inclusive check for day-granularity [start..end]. */
  export function isWithinInclusiveRangeYmd(target: string, start: string, end: string): boolean {
    return target >= start && target <= end;
  }
  
  /** Return a closed range [startYmd, endYmd] given start YMD and length nDays. */
  export function rangeFromStartAndN(
    startYmd: string,
    nDays: number
  ): { start: string; end: string } {
    if (nDays < 1) throw new Error("nDays must be >= 1");
    const end = addDaysYmd(startYmd, nDays - 1);
    return { start: startYmd, end };
  }
  