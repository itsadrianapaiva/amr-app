/**
 * Central toggle for GA4 debug mode.
 * Returns true on staging, or when URL has ?debug_mode=1, or when NEXT_PUBLIC_GA_DEBUG=1.
 * Safe on both server and client.
 */
export function isGaDebug(): boolean {
  // Never default to debug on the primary production hostname
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "amr-rentals.com") {
      // Allow manual override ONLY via URL param for one-off checks
      const params = new URLSearchParams(window.location.search);
      return params.get("debug_mode") === "1";
    }
  }

  // 1) Manual override via env for CI or forced staging
  if (process.env.NEXT_PUBLIC_GA_DEBUG === "1") return true;

  // 2) On the client, honor ?debug_mode=1 for ad-hoc testing
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    if (params.get("debug_mode") === "1") return true;

    // 3) Hostname heuristic for staging
    const host = window.location.hostname;
    if (
      host.startsWith("staging--") || // Netlify branch deploys
      host.includes("staging") || // generic staging host
      host.endsWith(".netlify.app") // Netlify preview domains
    ) {
      return true;
    }
  }

  // 4) Server-side env hints for RSC/server actions
  const env =
    process.env.NEXT_PUBLIC_APP_ENV ||
    process.env.NEXT_PUBLIC_VERCEL_ENV ||
    process.env.NODE_ENV;

  return env === "staging" || env === "preview";
}

/**
 * Waits for window.gtag to become available
 * Returns gtag function or null if timeout expires
 * Safe to call from SSR (returns null immediately)
 *
 * @param maxMs - Maximum time to wait in milliseconds (default 5000)
 * @returns Promise resolving to gtag function or null
 */
export async function waitForGtag(
  maxMs = 5000
): Promise<((...args: any[]) => void) | null> {
  // SSR safety: return null immediately if window is not available
  if (typeof window === "undefined") {
    return null;
  }

  // Check if gtag is already available
  const existingGtag = (window as any).gtag as
    | ((...args: any[]) => void)
    | undefined;
  if (existingGtag) {
    return existingGtag;
  }

  // Poll for gtag with 200ms interval
  return new Promise((resolve) => {
    const startTime = Date.now();
    const intervalId = setInterval(() => {
      const gtag = (window as any).gtag as
        | ((...args: any[]) => void)
        | undefined;

      if (gtag) {
        clearInterval(intervalId);
        resolve(gtag);
      } else if (Date.now() - startTime > maxMs) {
        clearInterval(intervalId);
        resolve(null);
      }
    }, 200);
  });
}
