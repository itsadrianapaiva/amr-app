/**
 * Meta Pixel event tracking helpers
 * Provides typed, safe wrappers around fbq() for standard events
 * Aligns with Meta's latest recommendations for manual event tracking
 */

import { isGaDebug } from "@/lib/analytics";

/**
 * Safely retrieves the fbq function from window
 * Returns null if fbq is not available (e.g., not loaded yet, ad blocker, etc.)
 */
function getFbq(): ((...args: any[]) => void) | null {
  if (typeof window === "undefined") return null;
  const fbq = (window as any).fbq;
  if (typeof fbq === "function") return fbq;

  // In debug mode, log a friendly message when fbq is missing
  if (isGaDebug()) {
    console.log("🔎 Meta Pixel: fbq not available");
  }

  return null;
}

/**
 * Fires a Meta PageView event
 * Should be called on SPA navigation for accurate page tracking
 *
 * @param args.path - Current page path (e.g., "/machine/1")
 * @param args.title - Optional page title
 */
export function metaPageView(args: { path: string; title?: string }): void {
  const fbq = getFbq();
  if (!fbq) return;

  const payload: Record<string, string> = {
    page_path: args.path,
  };

  if (args.title) {
    payload.page_title = args.title;
  }

  fbq("track", "PageView", payload);

  if (isGaDebug()) {
    console.log("🔎 Meta PageView", payload);
  }
}

/**
 * Fires a Meta ViewContent event
 * Should be called when a user views a product/machine detail page
 *
 * @param args.machineId - Machine ID
 * @param args.machineName - Machine name/title
 * @param args.category - Machine category (optional)
 * @param args.dailyRate - Daily rental rate in EUR (optional)
 */
export function metaViewContent(args: {
  machineId: number;
  machineName: string;
  category?: string | null;
  dailyRate?: number | null;
}): void {
  const fbq = getFbq();
  if (!fbq) return;

  const payload: Record<string, any> = {
    content_ids: [String(args.machineId)],
    content_name: args.machineName,
    content_type: "product",
  };

  if (args.category) {
    payload.content_category = args.category;
  }

  // Include value and currency if dailyRate is provided (approximate value)
  if (
    args.dailyRate !== null &&
    args.dailyRate !== undefined &&
    Number.isFinite(args.dailyRate)
  ) {
    payload.value = args.dailyRate;
    payload.currency = "EUR";
  }

  fbq("track", "ViewContent", payload);

  if (isGaDebug()) {
    console.log("🔎 Meta ViewContent", payload);
  }
}

/**
 * Fires a Meta InitiateCheckout event
 * Should be called when a user starts the booking/checkout process
 *
 * TODO: Wire metaInitiateCheckout from BookingForm when we refactor
 * the form handlers in a later approach. For now, this helper is ready
 * but not yet integrated into the booking flow to avoid touching
 * money-path logic.
 *
 * @param args.bookingId - Booking ID
 * @param args.machineId - Machine ID
 * @param args.machineName - Machine name
 * @param args.startDate - Booking start date (optional)
 * @param args.endDate - Booking end date (optional)
 * @param args.estimatedValue - Estimated booking value in EUR (optional)
 * @param args.currency - Currency code (defaults to EUR)
 */
export function metaInitiateCheckout(args: {
  bookingId: number;
  machineId: number;
  machineName: string;
  startDate?: string | null;
  endDate?: string | null;
  estimatedValue?: number | null;
  currency?: string;
}): void {
  const fbq = getFbq();
  if (!fbq) return;

  const payload: Record<string, any> = {
    content_ids: [String(args.machineId)],
    content_name: args.machineName,
    content_type: "product",
    num_items: 1,
  };

  // Include value and currency if estimatedValue is provided
  if (
    args.estimatedValue !== null &&
    args.estimatedValue !== undefined &&
    Number.isFinite(args.estimatedValue)
  ) {
    payload.value = args.estimatedValue;
    payload.currency = args.currency || "EUR";
  }

  // Optional custom fields for internal tracking
  if (args.bookingId) {
    payload.booking_id = args.bookingId;
  }
  if (args.startDate) {
    payload.start_date = args.startDate;
  }
  if (args.endDate) {
    payload.end_date = args.endDate;
  }

  fbq("track", "InitiateCheckout", payload);

  if (isGaDebug()) {
    console.log("🔎 Meta InitiateCheckout", payload);
  }
}

/**
 * Fires a Meta Purchase event
 * Should be called once when a booking is successfully confirmed
 * This is the primary conversion event for Meta's optimization
 *
 * IMPORTANT: Ensure this only fires once per booking via client-side guards
 *
 * @param args.bookingId - Booking ID
 * @param args.value - Total purchase value (VAT-included, in EUR)
 * @param args.currency - Currency code (should be EUR)
 * @param args.machineId - Machine ID
 * @param args.machineName - Machine name
 */
export function metaPurchase(args: {
  bookingId: number;
  value: number;
  currency: string;
  machineId: number;
  machineName: string;
}): void {
  const fbq = getFbq();
  if (!fbq) return;

  const payload: Record<string, any> = {
    value: args.value,
    currency: args.currency,
    content_ids: [String(args.machineId)],
    content_name: args.machineName,
    content_type: "product",
    // Optional but recommended: contents array with detailed item info
    contents: [
      {
        id: String(args.machineId),
        quantity: 1,
        item_price: args.value,
      },
    ],
  };

  fbq("track", "Purchase", payload);

  if (isGaDebug()) {
    console.log("🔎 Meta Purchase", payload);
  }
}

/**
 * Fires a custom Meta CTA_Click event
 * Should be called when users interact with high-intent CTAs
 *
 * @param args.cta_type - Type of CTA (e.g., "hero_primary", "catalog_nav", "machine_card", "contact")
 * @param args.cta_text - Button/link text displayed to user
 * @param args.cta_destination - Where the CTA leads (URL or anchor)
 * @param args.cta_location - Where on the page the CTA appears
 */
export function metaCtaClick(args: {
  cta_type: string;
  cta_text: string;
  cta_destination: string;
  cta_location: string;
}): void {
  const fbq = getFbq();
  if (!fbq) return;

  const payload: Record<string, any> = {
    cta_type: args.cta_type,
    cta_text: args.cta_text,
    cta_destination: args.cta_destination,
    cta_location: args.cta_location,
  };

  fbq("trackCustom", "CTA_Click", payload);

  if (isGaDebug()) {
    console.log("🔎 Meta CTA_Click", payload);
  }
}
