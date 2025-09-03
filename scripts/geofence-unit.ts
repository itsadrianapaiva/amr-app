// Local, dependency-free checks for our placeholder service area.
// No Mapbox needed. Verifies: Algarve with Faro cutoff, Alentejo coastal strip.
// Run with `npx tsx scripts/geofence-unit.ts`

import assert from "node:assert/strict"
import { isInsideServiceArea, SERVICE_AREA_NAME } from "@/lib/geo/service-area"

type Case = { name: string; lat: number; lng: number; expected: boolean }

// Coordinates are representative (not exact town centers); they target our rectangles.
const cases: Case[] = [
  // Algarve — inside (west/central)
  { name: "Lagos-ish (IN)",   lat: 37.10, lng: -8.60, expected: true },
  { name: "Portimão-ish (IN)",lat: 37.16, lng: -8.53, expected: true },

  // Faro boundary behavior
  { name: "Faro-ish (IN)",    lat: 37.02, lng: -7.92, expected: true }, // <= -7.90 → inside
  { name: "Olhão-ish (OUT)",  lat: 37.03, lng: -7.80, expected: false }, // > -7.90 → outside

  // Alentejo coastal strip — inside
  { name: "Sines-ish (IN)",   lat: 37.96, lng: -8.87, expected: true },
  { name: "Milfontes-ish (IN)",lat: 37.73, lng: -8.78, expected: true },

  // Inland / outside cases
  { name: "Beja-ish (OUT)",   lat: 38.02, lng: -7.86, expected: false },
  { name: "Lisboa-ish (OUT)", lat: 38.72, lng: -9.14, expected: false },
  { name: "North of box (OUT)",lat: 39.20, lng: -8.50, expected: false },
  { name: "South of box (OUT)",lat: 36.70, lng: -8.50, expected: false },

  // Edge case — exactly on Algarve west boundary: should count as inside.
  { name: "On west edge (IN)", lat: 37.20, lng: -8.999, expected: true },
]

async function main() {
  console.log(`Service area under test: ${SERVICE_AREA_NAME}\n`)
  let failures = 0
  for (const c of cases) {
    const inside = isInsideServiceArea(c.lat, c.lng)
    const pass = inside === c.expected
    console.log(`${pass ? "✅" : "❌"} ${c.name} → ${inside ? "IN " : "OUT"} (expected ${c.expected ? "IN" : "OUT"})`)
    if (!pass) failures++
  }
  assert.equal(failures, 0, `There were ${failures} geofence expectation failures.`)
  console.log("\nAll geofence expectations passed.")
}

main()
