/**
 * Server-only helper to validate whether a booking site address is inside our service area.
 * Returns `null` when OK, or a friendly error message when not OK.
 */

import { geocodeAddress } from "@/lib/geo/mapbox";
import {
  isInsideServiceArea,
  SERVICE_AREA_CENTROID,
} from "@/lib/geo/service-area";

/** Inputs from the booking form that affect geofencing. */
export type CheckServiceAreaParams = {
  deliverySelected: boolean;
  pickupSelected: boolean;
  siteAddress?: string | null; // free-text or normalized string
};

/** Optional knobs for testing and feature-flag control. */
type CheckServiceAreaOpts = {
  /** Allow tests to inject a fake geocoder. Defaults to Mapbox `geocodeAddress`. */
  geocode?: typeof geocodeAddress;
  /**
   * Override ENABLE_GEOFENCE for tests or previews.
   * Defaults to process.env.ENABLE_GEOFENCE === "true".
   */
  enable?: boolean;
};

const ENABLE_GEOFENCE =
  typeof process !== "undefined" && process.env?.ENABLE_GEOFENCE === "true";

/**
 * checkServiceArea
 * - Skips when geofence disabled or neither delivery nor pickup selected.
 * - Geocodes the address (PT-only) and checks against our polygon.
 * - Returns a concise, user-friendly message when outside or on error.
 */
export async function checkServiceArea(
  params: CheckServiceAreaParams,
  opts?: CheckServiceAreaOpts
): Promise<string | null> {
  const enabled = opts?.enable ?? ENABLE_GEOFENCE;
  if (!enabled) return null;

  const { deliverySelected, pickupSelected, siteAddress } = params;

  // No address validation needed when neither option is selected.
  if (!deliverySelected && !pickupSelected) return null;

  // Defensive UX: schema enforces address, but keep a helpful message here.
  if (!siteAddress || !siteAddress.trim()) {
    return "Please enter the site address so we can validate the service area.";
  }

  const geocode = opts?.geocode ?? geocodeAddress;

  // Geocode with a PT bias and local language for better disambiguation.
  let hit: Awaited<ReturnType<typeof geocodeAddress>> | null = null;
  try {
    hit = await geocode(siteAddress, {
      country: "pt",
      language: "pt",
      proximity: SERVICE_AREA_CENTROID, // nudges ambiguous results toward our zone
      limit: 1,
    });
  } catch (err) {
    console.error("[geo] Mapbox geocoding error:", err);
    return "Address lookup is temporarily unavailable. Please try again or contact us.";
  }

  if (!hit) {
    return "We could not locate this address in Portugal. Please check the spelling.";
  }

  // Book fence: Algarve up to Faro, plus Alentejo coastal strip.
  const inside = isInsideServiceArea(hit.lat, hit.lng);
  if (!inside) {
    return (
      `We're sorry. Your location is outside our current service area. ` +
      `Please contact us for options.`
    );
  }

  return null;
}

export default checkServiceArea;
