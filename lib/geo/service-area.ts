// FINAL (Simplified) Service Area: two rectangles approximating coastline coverage.
// This is intentionally simple and fast to evaluate server-side.
// Policy: Algarve up to Faro (IN), excluding Olhão/Tavira/VRSA (OUT),
// and Alentejo coastal strip Sines → Zambujeira (IN).
// On-edge counts as inside (see point-in-polygon.ts).

import {
  isPointInGeoJSON,
  type GeoPoint,
  type GeoJSONArea,
} from "./point-in-polygon";

export const SERVICE_AREA_NAME = "Algarve up to Faro + Alentejo Litoral";

// Algarve east boundary set to -7.90 so we INCLUDE Faro (~ -7.93) but EXCLUDE
// Olhão (~ -7.84), Tavira (~ -7.65) and Vila Real de Santo António (~ -7.42).
// Alentejo Litoral box north bound at 38.10 to EXCLUDE Lisbon/Setúbal, while keeping
// Sines / Porto Covo / Vila Nova de Milfontes / Zambujeira IN.
//
// Coordinates are [lng, lat] (GeoJSON). Rings may be open/closed.
const SERVICE_AREA: GeoJSONArea = {
  type: "MultiPolygon",
  coordinates: [
    // Algarve (tightened east edge at -7.90)
    // lng: [-8.999, -7.90], lat: [36.85, 37.50]
    [
      [
        [-8.999, 36.85],
        [-7.9, 36.85],
        [-7.9, 37.5],
        [-8.999, 37.5],
        [-8.999, 36.85],
      ],
    ],
    // Alentejo Litoral (tightened north bound at 38.10)
    // lng: [-9.35, -8.10], lat: [37.50, 38.10]
    [
      [
        [-9.35, 37.5],
        [-8.1, 37.5],
        [-8.1, 38.1],
        [-9.35, 38.1],
        [-9.35, 37.5],
      ],
    ],
  ],
} as const;

// Used as proximity hint for geocoding and as a UX fallback pin.
export const SERVICE_AREA_CENTROID = { lat: 37.75, lng: -8.4 } as const;

/** Returns true if (lat,lng) lies inside the simplified MultiPolygon. */
export function isInsideServiceArea(lat: number, lng: number): boolean {
  const p: GeoPoint = { lat, lng };
  return isPointInGeoJSON(p, SERVICE_AREA);
}

/** Exposes the geometry for diagnostics and tests. */
export function getServiceAreaGeometry(): GeoJSONArea {
  return SERVICE_AREA;
}
