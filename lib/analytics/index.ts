/**
 * Analytics utility module
 * Shared helpers for GA4 and Meta Pixel debug mode detection
 */

const PROD_HOSTS = ["amr-rentals.com", "www.amr-rentals.com"];

/**
 * Determines if analytics should run in debug mode
 * - Never debug on production domains by default
 * - Allow override via NEXT_PUBLIC_GA_DEBUG env var
 * - Enable on staging/preview environments
 * - Enable via ?debug_mode=1 URL parameter
 */
export function isGaDebug(): boolean {
  if (typeof window === "undefined") return false;

  // Check env override first
  const envDebug = process.env.NEXT_PUBLIC_GA_DEBUG;
  if (envDebug === "1" || envDebug === "true") return true;

  // Never debug on production hosts
  const hostname = window.location.hostname;
  if (PROD_HOSTS.includes(hostname)) return false;

  // Check URL parameter
  const params = new URLSearchParams(window.location.search);
  if (params.get("debug_mode") === "1") return true;

  // Enable on staging/preview by hostname heuristics
  if (
    hostname.includes("staging") ||
    hostname.includes("netlify") ||
    hostname.includes("localhost") ||
    hostname === "127.0.0.1"
  ) {
    return true;
  }

  return false;
}
