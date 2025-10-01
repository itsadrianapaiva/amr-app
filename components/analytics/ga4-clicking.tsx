"use client";

import React, { useRef, useCallback, cloneElement } from "react";

type Ga4ClickProps = {
  event: string;
  params?: Record<string, unknown>;
  once?: boolean;
  children: React.ReactElement<{ onClick?: React.MouseEventHandler }>;
};

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

export default function Ga4Click({
  event,
  params = {},
  once = true,
  children,
}: Ga4ClickProps) {
  const sentRef = useRef(false);

  const handleClick: React.MouseEventHandler = useCallback(
    async (e) => {
      if (typeof children.props.onClick === "function") {
        children.props.onClick(e);
      }

      if (once && sentRef.current) return;
      if (!readAnalyticsConsent()) {
        console.log("🔎 Ga4Click: blocked by consent", { event, params }); // NEW
        return;
      }

      const gtag = await waitForGtag();
      if (!gtag) {
        console.log("🔎 Ga4Click: gtag not ready", { event, params }); // NEW
        return;
      }

      gtag("event", event, params);
      sentRef.current = true;
      console.log("🔎 Ga4Click fired", { event, params }); // NEW
    },
    [children, event, JSON.stringify(params), once]
  );

  return cloneElement(children, { onClick: handleClick });
}
