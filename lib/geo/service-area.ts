// Service area: Algarve (Faro→Sagres) + Alentejo Litoral (BUFFERED) — placeholder geometry.
// NOTE: Replace with final pre-buffered MultiPolygon before launch.

import { isPointInGeoJSON, type GeoPoint, type GeoJSONArea } from "./point-in-polygon"

export const SERVICE_AREA_NAME = "Algarve up to Faro + Alentejo Litoral"

// Algarve east boundary set to -7.90 so we INCLUDE Faro (~ -7.93) but EXCLUDE Olhão (~ -7.84),
// Tavira (~ -7.65) and Vila Real de Santo António (~ -7.42).
// Alentejo Litoral box tightened north to 38.10 to EXCLUDE Lisbon/Setúbal, while keeping
// Sines / Porto Covo / Vila Nova de Milfontes / Zambujeira IN.
const SERVICE_AREA: GeoJSONArea = {
  type: "MultiPolygon",
  coordinates: [
    // Algarve (tightened east edge at -7.90)
    // lng: [-8.999, -7.90], lat: [36.85, 37.50]
    [
      [
        [-8.999, 36.85],
        [-7.90, 36.85],
        [-7.90, 37.50],
        [-8.999, 37.50],
        [-8.999, 36.85],
      ],
    ],
    // Alentejo Litoral (tightened north bound at 38.10)
    // lng: [-9.35, -8.10], lat: [37.50, 38.10]
    [
      [
        [-9.35, 37.50],
        [-8.10, 37.50],
        [-8.10, 38.10],
        [-9.35, 38.10],
        [-9.35, 37.50],
      ],
    ],
  ],
} as const

export const SERVICE_AREA_CENTROID = { lat: 37.75, lng: -8.4 } as const

export function isInsideServiceArea(lat: number, lng: number): boolean {
  const p: GeoPoint = { lat, lng }
  return isPointInGeoJSON(p, SERVICE_AREA)
}

export function getServiceAreaGeometry(): GeoJSONArea {
  return SERVICE_AREA
}
