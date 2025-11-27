/**
 * Header and footer navigation content.
 * Copy lives here so it is easy to update and localize.
 */

export type NavLink = {
  /** Visible text in the nav. Keep short for scanability. */
  label: string;
  /** URL path or hash section. Example: '/#catalog'. */
  href: string;
  /** Mark external links so components can add rel+target. */
  external?: boolean;
};

export type NavContent = {
  /** Primary navigation items. */
  links: NavLink[];

  /** Primary right-side CTA in the header. Drives conversion. */
  primaryCta: {
    label: string;
    href: string;
  };

  /** Optional contact channels. Component builds tel: and wa.me links. */
  phoneDisplay?: string | null;
  whatsappE164?: string | null;

  /** Short USP that we can show as a badge or subtle topbar. */
  uspShort?: string;
};

/**
 * Algarve USP: we are one of the only vendors with instant booking.
 * We reflect this in the CTA and an optional short tagline.
 */
export const NAV_CONTENT: NavContent = {
  links: [
    { label: "HOME", href: "/#home" },
    { label: "CATALOG", href: "/catalog" },
    { label: "ABOUT", href: "/#about" },
    { label: "FAQ", href: "/#faq" },
    { label: "CONTACT", href: "/#contact" },
  ],
  primaryCta: {
    label: "Book Online Now",
    href: "/catalog",
  },

  phoneDisplay: "(+351) 934 014 611",
  whatsappE164: "+351934014611",
  // Optional small tagline for a skinny top bar or badge near CTA.
  uspShort: "Instant booking in the Algarve",
};
