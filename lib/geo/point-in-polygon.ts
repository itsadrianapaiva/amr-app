// Small, focused geometry helpers for GeoJSON-style polygons (coordinates as [lng, lat]).

export interface GeoPoint { lat: number; lng: number }
export type LngLat = [number, number]           // [lng, lat] per GeoJSON
export type LinearRing = LngLat[]               // first and last vertex may repeat; not required
export type PolygonCoords = LinearRing[]        // [outerRing, hole1, hole2, ...]
export type MultiPolygonCoords = PolygonCoords[]

// Tolerance for "on edge" checks (in degrees). Keeps numerics stable for near-colinear cases.
const EPS = 1e-9

// Return true when point p lies on segment a-b (in the same coordinate plane).
function isPointOnSegment(p: LngLat, a: LngLat, b: LngLat): boolean {
  const [px, py] = p
  const [ax, ay] = a
  const [bx, by] = b

  // Cross product close to zero -> p, a, b are colinear.
  const cross = (bx - ax) * (py - ay) - (by - ay) * (px - ax)
  if (Math.abs(cross) > EPS) return false

  // dot <= 0 means px,py sits between a and b (inclusive) along both axes.
  const dot = (px - ax) * (px - bx) + (py - ay) * (py - by)
  return dot <= EPS
}

// Ray casting for a single ring. Returns true if inside, false if outside.
// If the point lies exactly on any edge, this returns true.
function isPointInRing(point: LngLat, ring: LinearRing): boolean {
  let inside = false
  const n = ring.length
  if (n === 0) return false

  // Iterate edges (j -> i). Works whether ring is explicitly closed or not.
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const pi = ring[i]
    const pj = ring[j]

    // On-edge is considered inside for our business rules.
    if (isPointOnSegment(point, pj, pi)) return true

    // Cast a horizontal ray to +∞ on lng axis and toggle on crossings.
    const yi = pi[1], yj = pj[1]
    const xi = pi[0], xj = pj[0]
    const intersects = (yi > point[1]) !== (yj > point[1]) &&
      (point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi + 0) + xi)

    if (intersects) inside = !inside
  }
  return inside
}

// Polygon with holes: point must be in outer ring and NOT in any hole ring.
export function isPointInPolygon(point: GeoPoint, polygon: PolygonCoords): boolean {
  const p: LngLat = [point.lng, point.lat]
  if (polygon.length === 0) return false

  if (!isPointInRing(p, polygon[0])) return false
  for (let i = 1; i < polygon.length; i++) {
    if (isPointInRing(p, polygon[i])) return false
  }
  return true
}

// MultiPolygon: inside if it's in at least one polygon (respecting holes).
export function isPointInMultiPolygon(point: GeoPoint, multi: MultiPolygonCoords): boolean {
  for (const poly of multi) {
    if (isPointInPolygon(point, poly)) return true
  }
  return false
}

// GeoJSON convenience types + single dispatcher.
export type GeoJSONPolygon = { type: "Polygon"; coordinates: PolygonCoords }
export type GeoJSONMultiPolygon = { type: "MultiPolygon"; coordinates: MultiPolygonCoords }
export type GeoJSONArea = GeoJSONPolygon | GeoJSONMultiPolygon

export function isPointInGeoJSON(point: GeoPoint, geom: GeoJSONArea): boolean {
  return geom.type === "Polygon"
    ? isPointInPolygon(point, geom.coordinates)
    : isPointInMultiPolygon(point, geom.coordinates)
}
