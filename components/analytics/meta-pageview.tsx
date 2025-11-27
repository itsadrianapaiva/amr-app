"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { metaPageView } from "@/lib/analytics/metaEvents";

/**
 * Fires Meta Pixel PageView events on client-side navigation (SPA routing)
 * Complements the initial PageView fired by FacebookPixel component
 *
 * This component listens to Next.js App Router navigation and sends
 * PageView events to Meta Pixel with the current path and title.
 */
export default function MetaPageview() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastPathRef = useRef<string>("");

  useEffect(() => {
    // Build full page path including query params
    const page_path =
      pathname +
      (searchParams?.toString() ? `?${searchParams.toString()}` : "");

    // Skip if this is the same path we just sent
    if (page_path === lastPathRef.current) {
      return;
    }

    // Update last sent path
    lastPathRef.current = page_path;

    // Get current page title if available
    const title =
      typeof document !== "undefined" ? document.title : undefined;

    // Fire Meta PageView event
    metaPageView({ path: page_path, title });
  }, [pathname, searchParams]);

  return null;
}
