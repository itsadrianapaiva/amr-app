// Quick local verifier for our geofence policy using Mapbox and our service-area check.
// Run with `npx tsx scripts/geofence-smoke.ts`

import { config } from 'dotenv'
config({ path: '.env.local' }) // load local env for scripts
import { geocodeAddress } from "@/lib/geo/mapbox"
import { isInsideServiceArea, SERVICE_AREA_NAME } from "@/lib/geo/service-area"

type Case = { label: string; address: string }

const cases: Case[] = [
  // Algarve IN (west and central)
  { label: "Faro (IN)", address: "Faro, Portugal" },
  { label: "Portimão (IN)", address: "Portimão, Portugal" },
  { label: "Lagos (IN)", address: "Lagos, Portugal" },
  { label: "Sagres (IN)", address: "Sagres, Portugal" },
  { label: "Vilamoura (IN)", address: "Vilamoura, Portugal" },

  // Alentejo Litoral IN
  { label: "Sines (IN)", address: "Sines, Portugal" },
  { label: "Porto Covo (IN)", address: "Porto Covo, Portugal" },
  { label: "Vila Nova de Milfontes (IN)", address: "Vila Nova de Milfontes, Portugal" },
  { label: "Zambujeira do Mar (IN)", address: "Zambujeira do Mar, Portugal" },

  // East Algarve OUT by policy
  { label: "Olhão (OUT)", address: "Olhão, Portugal" },
  { label: "Tavira (OUT)", address: "Tavira, Portugal" },
  { label: "Vila Real de Santo António (OUT)", address: "Vila Real de Santo António, Portugal" },

  // Inland OUT
  { label: "Beja (OUT)", address: "Beja, Portugal" },
  { label: "Lisboa (OUT)", address: "Lisboa, Portugal" },
]

async function main() {
  const token = process.env.MAPBOX_ACCESS_TOKEN
  if (!token) {
    console.error("Missing MAPBOX_ACCESS_TOKEN in env.")
    process.exit(1)
  }

  console.log(`Service area: ${SERVICE_AREA_NAME}\n`)

  for (const c of cases) {
    const hit = await geocodeAddress(c.address, {
      country: "pt",
      language: "pt",
      limit: 1,
    })

    if (!hit) {
      console.log(`${c.label.padEnd(30)} → not found`)
      continue
    }

    const inside = isInsideServiceArea(hit.lat, hit.lng)
    const status = inside ? "IN " : "OUT"
    console.log(`${c.label.padEnd(30)} → ${status}  (${hit.lat.toFixed(5)}, ${hit.lng.toFixed(5)})`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
