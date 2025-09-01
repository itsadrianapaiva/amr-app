/**
 * Footer content configuration.
 * Keep ALL copy and small presentation bits here for easy editing/localization.
 */

export type FooterContent = {
  companyName: string;

  /** Address lines rendered on separate lines. Keep short for wrapping on mobile. */
  addressLines: string[];

  /** Public contact channels (optional for MVP). Use null to hide. */
  phoneDisplay?: string | null;
  email?: string | null;

  /** Small CTA shown in the footer (optional). */
  footerCta?: { label: string; href: string } | null;

  /** Credits & legal text. */
  copyrightOwner?: string; // defaults to companyName if omitted
  designedBy?: { label: string; href: string } | null;
};

export const FOOTER_CONTENT: FooterContent = {
  companyName: "Algarve Machinery Rentals",

  // Keep it general until the final address is approved.
  addressLines: ["Algarve, Portugal"],

  // No phone yet — placeholder for layout; set to null to hide completely.
  phoneDisplay: "000 000 000", // "Your phone here",
  // Set when ready (e.g., "hello@amr.pt"); null hides the email row.
  email: "amr.business.pt@gmail.com", //add correct one later

  // Small CTA in the footer. Mirrors primary funnel.
  footerCta: { label: "Book now", href: "/#catalog" },

  // Credits (can hide by setting to nulls).
  copyrightOwner: "AMR Rentals",
  designedBy: { label: "Adriana Paiva", href: "https://itsadrianapaiva.com" },
};
