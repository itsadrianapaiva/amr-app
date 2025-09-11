import { describe, it, expect } from "vitest";
import {
  ymdFromDateLisbon,
  addDaysYmd,
  computeEarliestStartYmd,
  isWithinInclusiveRangeYmd,
  rangeFromStartAndN,
} from "../../e2e/utils/dates";

/**
 * Notes:
 * - We pick September dates (DST in Lisbon = UTC+1) to make cutoff tests explicit.
 * - computeEarliestStartYmd(now, leadDays=2, cutoff=15):
 *   earliest = todayLisbon + 2 (+1 extra day if Lisbon hour >= 15).
 */

describe("ymdFromDateLisbon", () => {
  it("formats Lisbon local date even across UTC boundaries", () => {
    // 2025-09-11 23:30Z = 2025-09-12 00:30 Lisbon (DST +1)
    const d = new Date("2025-09-11T23:30:00Z");
    expect(ymdFromDateLisbon(d)).toBe("2025-09-12");
  });
});

describe("addDaysYmd", () => {
  it("adds days in UTC without DST drift", () => {
    expect(addDaysYmd("2025-09-10", 5)).toBe("2025-09-15");
  });
});

describe("computeEarliestStartYmd (Lisbon cutoff @15:00)", () => {
  it("returns today + 2 when before cutoff", () => {
    // 14:59 Lisbon == 13:59Z during DST (+1)
    const beforeCutoff = new Date("2025-09-11T13:59:00Z");
    expect(computeEarliestStartYmd(beforeCutoff, 2, 15)).toBe("2025-09-13");
  });

  it("returns today + 3 when at/after cutoff", () => {
    // 15:00 Lisbon == 14:00Z during DST (+1)
    const atCutoff = new Date("2025-09-11T14:00:00Z");
    expect(computeEarliestStartYmd(atCutoff, 2, 15)).toBe("2025-09-14");
  });
});

describe("range helpers", () => {
  it("isWithinInclusiveRangeYmd works on edges", () => {
    expect(
      isWithinInclusiveRangeYmd("2025-09-12", "2025-09-10", "2025-09-12")
    ).toBe(true);
    expect(
      isWithinInclusiveRangeYmd("2025-09-13", "2025-09-10", "2025-09-12")
    ).toBe(false);
  });

  it("rangeFromStartAndN returns closed range [start..end]", () => {
    const r = rangeFromStartAndN("2025-09-10", 3);
    expect(r).toEqual({ start: "2025-09-10", end: "2025-09-12" });
  });
});
