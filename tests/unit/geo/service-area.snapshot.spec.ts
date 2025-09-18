import { describe, it, expect } from "vitest";
import {
  getServiceAreaGeometry,
  SERVICE_AREA_NAME,
} from "@/lib/geo/service-area";

/**
 * roundCoords
 * Deeply rounds any numeric coordinates to a fixed precision so snapshots
 * stay stable across OS/Node builds and minor float jitter.
 */
function roundCoords<T>(value: T, precision = 4): T {
  const factor = 10 ** Math.max(0, precision);
  const roundNum = (n: number) => Math.round(n * factor) / factor;

  const visit = (v: unknown): unknown => {
    if (typeof v === "number") return roundNum(v);
    if (Array.isArray(v)) return v.map(visit);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        out[k] = visit(val);
      }
      return out;
    }
    return v;
  };

  return visit(value) as T;
}

describe("Service area geometry snapshot", () => {
  it("exports a stable MultiPolygon for CI guardrails", () => {
    const geom = getServiceAreaGeometry();
    // Contract checks: fail fast if someone changes the shape type.
    expect(geom.type).toBe("MultiPolygon");
    expect(Array.isArray(geom.coordinates)).toBe(true);

    // Snapshot only the essentials, rounded for stability.
    const snapshotPayload = {
      name: SERVICE_AREA_NAME,
      type: geom.type,
      coordinates: roundCoords(geom.coordinates, 4),
    };

    expect(snapshotPayload).toMatchSnapshot();
  });
});
