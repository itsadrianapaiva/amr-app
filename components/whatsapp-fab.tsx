import { CONTACTS } from "@/lib/content/contacts";
import { buildWhatsAppHref } from "@/lib/contacts/utils";
import Image from "next/image";

type Props = {
  /** Defaults to /assets/whatsapp.png (under /public). */
  iconSrc?: string;
  /** Portuguese label kept to mirror your P4 implementation. */
  ariaLabel?: string;
};

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
      {/* ping halo */}
      <span className="absolute z-10 h-12 w-12 animate-ping rounded-full bg-green-500/40 opacity-75 sm:h-16 sm:w-16" />
      {/* icon */}
      <Image
        src={iconSrc}
        alt="WhatsApp"
        width={64}
        height={64}
        loading="lazy"
        fetchPriority="low"
        sizes="(min-width:640px) 64px, 48px"
        className="relative z-20 h-12 w-12 sm:h-16 sm:w-16"
      />
    </a>
  );
}
