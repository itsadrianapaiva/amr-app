/**
 * Central toggle for GA4 debug mode.
 * Returns true on staging, or when URL has ?debug_mode=1, or when NEXT_PUBLIC_GA_DEBUG=1.
 * Safe on both server and client.
 */
export function isGaDebug(): boolean {
    // 1) Manual override via env for CI or forced staging
    if (process.env.NEXT_PUBLIC_GA_DEBUG === "1") return true;
  
    // 2) On the client, honor ?debug_mode=1 for ad-hoc testing
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("debug_mode") === "1") return true;
  
      // 3) Hostname heuristic for staging
      const host = window.location.hostname;
      if (
        host.startsWith("staging--") ||                 // Netlify branch deploys
        host.includes("staging") ||                     // generic staging host
        host.endsWith(".netlify.app")                   // Netlify preview domains
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
  