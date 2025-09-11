import { describe, it, expect } from "vitest"
import { isInsideServiceArea, getServiceAreaGeometry, SERVICE_AREA_NAME } from "@/lib/geo/service-area"

/**
 * Geofence unit tests
 * - Coordinates chosen to exercise our placeholder rectangles.
 * - Contract: "on-edge counts as inside".
 * - Coordinate order: inputs to isInsideServiceArea are (lat, lng).
 */

describe(`Geofence — ${SERVICE_AREA_NAME}`, () => {
  it("includes west/central Algarve", () => {
    // Lagos-ish
    expect(isInsideServiceArea(37.10, -8.60)).toBe(true)
    // Portimão-ish
    expect(isInsideServiceArea(37.16, -8.53)).toBe(true)
    // Sagres-ish
    expect(isInsideServiceArea(37.01, -8.94)).toBe(true)
  })

  it("includes Faro but excludes Olhão/Tavira/VRSA (east cutoff at -7.90)", () => {
    // Faro ≈ -7.92 (<= -7.90 → IN)
    expect(isInsideServiceArea(37.02, -7.92)).toBe(true)

    // East Algarve OUT by policy (> -7.90 → OUT)
    expect(isInsideServiceArea(37.03, -7.80)).toBe(false) // Olhão-ish
    expect(isInsideServiceArea(37.13, -7.65)).toBe(false) // Tavira-ish
    expect(isInsideServiceArea(37.20, -7.42)).toBe(false) // VRSA-ish
  })

  it("includes Alentejo coastal strip (Sines → Zambujeira)", () => {
    expect(isInsideServiceArea(37.96, -8.87)).toBe(true) // Sines-ish
    expect(isInsideServiceArea(37.85, -8.79)).toBe(true) // Porto Covo-ish
    expect(isInsideServiceArea(37.73, -8.78)).toBe(true) // Milfontes-ish
    expect(isInsideServiceArea(37.53, -8.78)).toBe(true) // Zambujeira-ish
  })

  it("treats polygon borders as inside (edge & vertex cases)", () => {
    // Exactly on Algarve east edge lng = -7.90, lat within band → IN
    expect(isInsideServiceArea(37.30, -7.90)).toBe(true)

    // Exactly on Alentejo rectangle vertex → IN
    // Vertex at (-9.35, 37.50) => (lat=37.50, lng=-9.35)
    expect(isInsideServiceArea(37.50, -9.35)).toBe(true)
  })

  it("excludes inland/out-of-bounds cases", () => {
    expect(isInsideServiceArea(38.02, -7.86)).toBe(false) // Beja-ish
    expect(isInsideServiceArea(38.72, -9.14)).toBe(false) // Lisboa-ish
    expect(isInsideServiceArea(39.20, -8.50)).toBe(false) // North of box
    expect(isInsideServiceArea(36.70, -8.50)).toBe(false) // South of box
  })

  it("exposes MultiPolygon geometry (stable contract)", () => {
    const geom = getServiceAreaGeometry()
    expect(geom.type).toBe("MultiPolygon")
    // sanity: two rectangles (Algarve, Alentejo)
    expect(geom.coordinates.length).toBe(2)
  })
})
