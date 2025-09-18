// lib/geo/parse-headers.ts
/**
 * Parses geolocation from common CDN/server headers into a normalized shape.
 * - Netlify:   "x-nf-geo": JSON with { latitude, longitude }
 * - Vercel:    "x-vercel-ip-latitude", "x-vercel-ip-longitude"
 * - Cloudflare:"cf-iplatitude", "cf-iplongitude"
 *
 * Returns { lat, lng } or null when unavailable/invalid.
 * Pure and dependency-free so unit tests are trivial.
 */

export type LatLng = { lat: number; lng: number };

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * parseGeoFromHeaders
 * @param headers - a minimal dictionary-like object (Node/Fetch compatible):
 *   - string keys (case-insensitive), values: string | string[] | undefined
 *   - Accepts Request.headers converted via Object.fromEntries(new Headers(req.headers))
 */
export function parseGeoFromHeaders(
  headers: Record<string, string | string[] | undefined>
): LatLng | null {
  // Normalize keys to lowercase for case-insensitive access.
  const map: Record<string, string | string[] | undefined> = {};
  for (const [k, v] of Object.entries(headers)) map[k.toLowerCase()] = v;

  // 1) Netlify: x-nf-geo (JSON)
  // Example: {"city":"Lisbon","latitude":"38.7167","longitude":"-9.1333", ...}
  const nf = map["x-nf-geo"];
  if (nf) {
    try {
      const obj =
        typeof nf === "string"
          ? JSON.parse(nf)
          : Array.isArray(nf)
            ? JSON.parse(nf[0] ?? "")
            : null;
      if (obj) {
        const lat = toNumber(obj.latitude);
        const lng = toNumber(obj.longitude);
        if (lat !== null && lng !== null) return { lat, lng };
      }
    } catch {
      // ignore JSON errors; fall through to other providers
    }
  }

  // 2) Vercel: x-vercel-ip-latitude / x-vercel-ip-longitude
  const vLat = map["x-vercel-ip-latitude"];
  const vLng = map["x-vercel-ip-longitude"];
  if (vLat != null && vLng != null) {
    const lat = toNumber(Array.isArray(vLat) ? vLat[0] : vLat);
    const lng = toNumber(Array.isArray(vLng) ? vLng[0] : vLng);
    if (lat !== null && lng !== null) return { lat, lng };
  }

  // 3) Cloudflare: cf-iplatitude / cf-iplongitude
  const cfLat = map["cf-iplatitude"];
  const cfLng = map["cf-iplongitude"];
  if (cfLat != null && cfLng != null) {
    const lat = toNumber(Array.isArray(cfLat) ? cfLat[0] : cfLat);
    const lng = toNumber(Array.isArray(cfLng) ? cfLng[0] : cfLng);
    if (lat !== null && lng !== null) return { lat, lng };
  }

  return null;
}
