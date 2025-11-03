import { CONTACTS } from "@/lib/content/contacts";
import { buildWhatsAppHref } from "@/lib/contacts/utils";

type Props = {
  /** Defaults to /assets/whatsapp.png (lives under /public). */
  iconSrc?: string;
  /** Portuguese label kept to mirror production behavior. */
  ariaLabel?: string;
};

/**
 * PERF-TUNING v2025-10-31
 * We intentionally use a plain <img> here instead of <Image />.
 *
 * Reason:
 * - On Netlify staging, Next.js' on-demand image optimizer was returning 400
 *   for small local assets like /assets/whatsapp.png when called via <Image />.
 * - This FAB icon is not LCP-critical and it's a fixed-size icon, so we do NOT
 *   need responsive resizing or format negotiation here.
 * - Using <img> bypasses /_next/image entirely, so staging stops breaking.
 */
export default function WhatsAppFab({
  iconSrc = "/assets/whatsapp.png",
  ariaLabel = "Contacte-nos no WhatsApp",
}: Props) {
  const whatsappUrl = buildWhatsAppHref(CONTACTS.support.whatsapp);

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-14 right-6 z-50 flex items-center justify-center"
      aria-label={ariaLabel}
    >
      {/* pulse halo */}
      <span className="absolute z-10 h-12 w-12 animate-ping rounded-full bg-green-500/40 opacity-75 sm:h-16 sm:w-16" />

      {/* icon */}
      <img
        src={iconSrc}
        alt="WhatsApp"
        width={64}
        height={64}
        loading="lazy"
        className="relative z-20 h-12 w-12 sm:h-16 sm:w-16 select-none"
        draggable={false}
      />
    </a>
  );
}
