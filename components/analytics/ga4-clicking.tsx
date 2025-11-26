"use client";

import { isGaDebug, waitForGtag } from "@/lib/analytics";
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
        console.log("🔎 Ga4Click: blocked by consent", { event, params });
        return;
      }

      const gtag = await waitForGtag();
      if (!gtag) {
        console.log("🔎 Ga4Click: gtag not ready", { event, params });
        return;
      }

      const payload = { ...params, debug_mode: isGaDebug() };
      gtag("event", event, payload);

      sentRef.current = true;
      console.log("🔎 Ga4Click fired", { event, params });
    },
    [children, event, JSON.stringify(params), once]
  );

  return cloneElement(children, { onClick: handleClick });
}
