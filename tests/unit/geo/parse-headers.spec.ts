import { describe, it, expect } from "vitest";
import { parseGeoFromHeaders, type LatLng } from "@/lib/geo/parse-headers";

function coordsEqual(a: LatLng | null, b: LatLng | null) {
  if (!a || !b) return a === b;
  // exact equality is fine here; inputs are small fixed strings/numbers
  return a.lat === b.lat && a.lng === b.lng;
}

describe("parseGeoFromHeaders", () => {
  it("parses Netlify x-nf-geo JSON header", () => {
    const headers = {
      "x-nf-geo": JSON.stringify({
        city: "Portimão",
        latitude: "37.136",
        longitude: "-8.539",
      }),
    };
    const got = parseGeoFromHeaders(headers);
    expect(coordsEqual(got, { lat: 37.136, lng: -8.539 })).toBe(true);
  });

  it("parses Vercel x-vercel-ip-latitude/longitude headers", () => {
    const headers = {
      "x-vercel-ip-latitude": "37.10",
      "x-vercel-ip-longitude": "-8.60",
    };
    const got = parseGeoFromHeaders(headers);
    expect(coordsEqual(got, { lat: 37.1, lng: -8.6 })).toBe(true);
  });

  it("parses Cloudflare cf-iplatitude/iplongitude headers", () => {
    const headers = {
      "cf-iplatitude": "37.02",
      "cf-iplongitude": "-7.92",
    };
    const got = parseGeoFromHeaders(headers);
    expect(coordsEqual(got, { lat: 37.02, lng: -7.92 })).toBe(true);
  });

  it("handles header arrays (multiple values) by taking the first", () => {
    const headers = {
      "x-vercel-ip-latitude": ["37.10", "99.99"],
      "x-vercel-ip-longitude": ["-8.60", "0"],
    };
    const got = parseGeoFromHeaders(headers);
    expect(coordsEqual(got, { lat: 37.1, lng: -8.6 })).toBe(true);
  });

  it("is case-insensitive with header names", () => {
    const headers = {
      "X-NF-GEO": JSON.stringify({ latitude: 37.16, longitude: -8.53 }),
    };
    const got = parseGeoFromHeaders(headers);
    expect(coordsEqual(got, { lat: 37.16, lng: -8.53 })).toBe(true);
  });

  it("returns null on malformed Netlify JSON", () => {
    const headers = {
      "x-nf-geo": "{not-json",
    };
    const got = parseGeoFromHeaders(headers);
    expect(got).toBeNull();
  });

  it("returns null when numbers are invalid/non-finite", () => {
    const headersA = {
      "x-vercel-ip-latitude": "not-a-number",
      "x-vercel-ip-longitude": "-8.60",
    };
    const headersB = {
      "cf-iplatitude": "37.10",
      "cf-iplongitude": "NaN",
    };
    expect(parseGeoFromHeaders(headersA)).toBeNull();
    expect(parseGeoFromHeaders(headersB)).toBeNull();
  });

  it("returns null when no known headers are present", () => {
    const got = parseGeoFromHeaders({ "some-header": "value" });
    expect(got).toBeNull();
  });
});
