"use client";

import React, { useRef, useCallback, cloneElement } from "react";

type Ga4ClickProps = {
  /** GA4 event name, e.g., "booking_submit" or "begin_checkout" */
  event: string;
  /** Optional parameters to send with the event (no PII) */
  params?: Record<string, unknown>;
  /** Fire only once per mount to avoid double clicks */
  once?: boolean;
  /** Single clickable child (e.g., <Button/>) */
  children: React.ReactElement<{ onClick?: React.MouseEventHandler }>;
};

/** Read analytics consent from our cookie, same policy as Ga4Purchase */
function readAnalyticsConsent(): boolean {
  try {
    const m = document.cookie.match(/(?:^|;\s*)amr_consent=([^;]+)/);
    if (!m) return false;
    const obj = JSON.parse(decodeURIComponent(m[1])) as { analytics?: boolean };
    return !!obj.analytics;
  } catch {
    return false;
  }
}

/** Wait for gtag so we don't drop the first click if tag loads late */
async function waitForGtag(
  maxMs = 5000
): Promise<((...a: any[]) => void) | null> {
  const start = Date.now();
  while (Date.now() - start <= maxMs) {
    const g = (window as any).gtag as ((...a: any[]) => void) | undefined;
    if (g) return g;
    await new Promise((r) => setTimeout(r, 200));
  }
  return null;
}

/**
 * Ga4Click: wraps a clickable child and emits a GA4 event on click.
 * - Consent-aware
 * - De-duped via `once`
 * - Preserves child's original onClick
 */
export default function Ga4Click({
  event,
  params = {},
  once = true,
  children,
}: Ga4ClickProps) {
  const sentRef = useRef(false);

  const handleClick: React.MouseEventHandler = useCallback(
    async (e) => {
      // Let the original onClick run first (do not break submit behavior).
      if (typeof children.props.onClick === "function") {
        children.props.onClick(e);
      }

      if (once && sentRef.current) return;
      if (!readAnalyticsConsent()) return;

      const gtag = await waitForGtag();
      if (!gtag) return;

      gtag("event", event, params);
      sentRef.current = true;
      // console.log("[GA4] click event:", event, params);
    },
    [children, event, JSON.stringify(params), once]
  );

  // Merge our onClick with the child's props without altering visuals.
  return cloneElement(children, {
    onClick: handleClick,
  });
}
