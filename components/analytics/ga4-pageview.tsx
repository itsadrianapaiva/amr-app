"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { isGaDebug, waitForGtag } from "@/lib/analytics";

/**
 * Fires GA4 page_view on every client-side navigation (Next.js App Router).
 * Also sends a one-time debug ping after gtag is ready.
 *
 * No env reads here; layout already loads/configs gtag.
 * This component ONLY emits events at the right time.
 */

export default function Ga4Pageview() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pingedRef = useRef(false);

  useEffect(() => {
    // One-time debug ping after gtag is ready (helps confirm Realtime)
    (async () => {
      if (pingedRef.current) return;
      const gtag = await waitForGtag();
      if (!gtag) return;
      gtag("event", "amr_debug_ping", {
        source: "Ga4Pageview",
        debug_mode: isGaDebug(),
      });
      pingedRef.current = true;
    })();
  }, []);

  useEffect(() => {
    // Fire page_view on every client-side navigation
    (async () => {
      const gtag = await waitForGtag();
      if (!gtag) return;

      const page_path =
        pathname +
        (searchParams?.toString() ? `?${searchParams.toString()}` : "");

      gtag("event", "page_view", {
        // Use GA4-recommended param names
        page_location:
          typeof window !== "undefined" ? window.location.href : undefined,
        page_path,
        page_title: document.title,
        debug_mode: isGaDebug(),
      });

      // Optional: console marker for debugging; remove later
      // console.log("🔎 GA4 page_view", { page_path });
    })();
  }, [pathname, searchParams]);

  return null;
}
