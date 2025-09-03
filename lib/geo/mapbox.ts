// Minimal Mapbox Geocoding client for server-side usage.
// Turns a free-form address into { lat, lng } using the Mapbox Places API.

export type GeocodeHit = {
  lat: number
  lng: number
  placeName: string
  // Keep raw for debugging while we wire things; you can drop it later.
  raw?: unknown
}

export type GeocodeOptions = {
  language?: string     // e.g., "en" or "pt"
  country?: string      // e.g., "pt" (restrict to Portugal)
  proximity?: { lat: number; lng: number } // bias results near a coordinate
  limit?: number        // default 1
}

/**
 * geocodeAddress
 * Resolves a free-text address to the first best match (WGS84).
 * Returns null if no features match.
 * Throws if MAPBOX_ACCESS_TOKEN is missing or the HTTP request fails.
 */
export async function geocodeAddress(
  query: string,
  opts: GeocodeOptions = {}
): Promise<GeocodeHit | null> {
  const token = process.env.MAPBOX_ACCESS_TOKEN
  if (!token) {
    throw new Error("Missing MAPBOX_ACCESS_TOKEN")
  }

  const params = new URLSearchParams()
  params.set("access_token", token)
  params.set("autocomplete", "false")
  params.set("limit", String(opts.limit ?? 1))
  if (opts.language) params.set("language", opts.language)
  if (opts.country) params.set("country", opts.country)
  if (opts.proximity) {
    params.set("proximity", `${opts.proximity.lng},${opts.proximity.lat}`)
  }

  const base = "https://api.mapbox.com/geocoding/v5/mapbox.places"
  const url = `${base}/${encodeURIComponent(query)}.json?${params.toString()}`

  // Server-side fetch; no caching since addresses may include recent POIs.
  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) {
    throw new Error(`Mapbox geocoding failed: ${res.status} ${res.statusText}`)
  }

  const payload = await res.json()
  const feat = payload?.features?.[0]
  if (!feat) return null

  const center = Array.isArray(feat.center) ? feat.center : null
  const [lng, lat] = center ?? []
  if (typeof lat !== "number" || typeof lng !== "number") return null

  return {
    lat,
    lng,
    placeName: String(feat.place_name ?? query),
    raw: feat,
  }
}
