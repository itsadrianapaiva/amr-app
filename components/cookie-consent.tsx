"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type ConsentLevel = "all" | "functional";

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
    setVisible(!existing);
  }, []);

  if (!mounted || !visible) return null;

  const accept = (level: ConsentLevel) => {
    setCookie("amr_consent", level);
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-50"
    >
      <div className="mx-auto w-full max-w-5xl px-4 pb-4">
        <div className="rounded-2xl border bg-background/95 p-4 shadow-lg backdrop-blur">
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
            <Button size="sm" onClick={() => accept("all")}>
              Allow all cookies
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => accept("functional")}
            >
              Functional only
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
