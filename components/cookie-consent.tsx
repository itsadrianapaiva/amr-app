"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type ConsentPayload = { analytics: boolean; ads: boolean };

// Small helpers kept inside this file to avoid extra imports.
function getCookie(name: string) {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : "";
}

function setCookie(name: string, value: string, days = 180) {
  if (typeof document === "undefined") return;
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(
    value
  )}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
}

function writeConsentAndBroadcast(payload: ConsentPayload) {
  setCookie("amr_consent", JSON.stringify(payload));
  // Inform ConsentProvider + Ga4Purchase listeners immediately
  window.dispatchEvent(new CustomEvent("amr:consent", { detail: payload }));
}

// Backward-compat migration for legacy values "all" | "functional"
function migrateLegacyIfNeeded(raw: string) {
  if (!raw) return false;
  if (raw === "all") {
    writeConsentAndBroadcast({ analytics: true, ads: false });
    return true;
  }
  if (raw === "functional") {
    writeConsentAndBroadcast({ analytics: false, ads: false });
    return true;
  }
  return false;
}

/**
 * CookieConsentBanner
 * - Non-blocking, accessible banner shown at the bottom.
 * - Stores "amr_consent" as "all" or "functional".
 * - No trackers are enabled here; this only records preference.
 */
export default function CookieConsentBanner({
  policyHref = "/legal/privacy",
}: {
  policyHref?: string;
}) {
  // Avoid SSR flash: only decide visibility after mount.
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
    const existing = getCookie("amr_consent");

    // If we find legacy string values, migrate them to JSON and hide banner.
    if (migrateLegacyIfNeeded(existing)) {
      setVisible(false);
      return;
    }

    // If we already have JSON consent, hide; otherwise show.
    try {
      const parsed = existing ? JSON.parse(existing) : null;
      const hasJsonShape =
        parsed && typeof parsed === "object" && "analytics" in parsed;
      setVisible(!hasJsonShape);
    } catch {
      // Non-JSON garbage → show banner
      setVisible(true);
    }
  }, []);

  if (!mounted || !visible) return null;

  const acceptAll = () => {
    writeConsentAndBroadcast({ analytics: true, ads: true });
    setVisible(false);
  };

  const functionalOnly = () => {
    writeConsentAndBroadcast({ analytics: false, ads: false });
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-50"
    >
      <div className="mx-auto w-full max-w-5xl px-4 pb-4">
        <div className="rounded-2xl border bg-foreground/20 p-4 shadow-lg backdrop-blur">
          <p className="text-sm leading-relaxed">
            We use essential cookies to make this site work and optional cookies
            to improve the experience. You can accept all cookies or keep only
            functional ones. See our{" "}
            <Link
              href={policyHref}
              className="underline underline-offset-4 hover:no-underline"
            >
              Privacy Policy
            </Link>
            .
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={acceptAll}>
              Allow all cookies
            </Button>
            <Button size="sm" variant="outline" onClick={functionalOnly}>
              Functional only
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
