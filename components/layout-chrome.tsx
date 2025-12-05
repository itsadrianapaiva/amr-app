"use client";

import { usePathname } from "next/navigation";
import CookieConsentBanner from "@/components/cookie-consent";
import WhatsAppFab from "@/components/whatsapp-fab";

/**
 * LayoutChrome: mounts UI chrome that should be global,
 * except on specific routes like the booking success page.
 *
 * Hidden on:
 * - /booking/success  → reduce hydration risk and keep success page minimal
 */
export default function LayoutChrome() {
  const pathname = usePathname();
  const hideOnSuccess = pathname === "/booking/success";

  if (hideOnSuccess) return null;

  return (
    <>
      <WhatsAppFab
        iconSrc="/assets/optimized/whatsapp.webp"
        ariaLabel="Contact us on WhatsApp"
      />
      <CookieConsentBanner policyHref="/legal/privacy" />
    </>
  );
}
