/**
 * Home page content config.
 * Keeps copy and small presentation bits out of components so we can iterate and localize easily.
 */

export type HeroContent = {
  /** Small pretitle to highlight our unique selling point. */
  pretitle: string;
  /** Main headline (kept intentionally small in the component). */
  title: string;
  /** Supporting sentence under the title. */
  subtitle: string;

  /** Primary CTA */
  primaryHref: string;
  primaryLabel: string;

  /** Optional WhatsApp CTA (rendered only when provided). */
  whatsappNumberE164?: string | null;
  whatsappLabel: string;

  /** Background utility to plug a future hero photo (e.g., 'bg-hero bg-cover bg-center bg-no-repeat'). */
  backgroundClassName?: string;
};

export const HOME_HERO: HeroContent = {
  // USP front and center — what sets AMR apart.
  pretitle: "Book online. 25% off now",
  title: "Pro-grade machinery in the Algarve",
  subtitle:
    "See live availability and real time pricing. Choose dates, add extras, and confirm in minutes. Instant confirmation with fast delivery or pickup.",

  primaryHref: "#catalog",
  primaryLabel: "Book Online Now",

  // Set when ready to enable WhatsApp CTA, e.g. "+3519XXXXXXXX"
  whatsappNumberE164: "+351934014611",
  whatsappLabel: "Need help? Chat on WhatsApp",

  // Hook for the future background photo (your globals already define color tokens).
  backgroundClassName: "bg-hero bg-cover bg-center bg-no-repeat",
};

/** Inventory section copy sitting below the hero. */
export type InventorySectionContent = {
  pretitle: string;
  title: string;
  subtitle: string;
};

export const HOME_INVENTORY: InventorySectionContent = {
  pretitle: "Our Inventory",
  title: "Everything your site needs, ready to book",
  subtitle:
    "Browse reliable machines with clear pricing. Reserve online in minutes. No phone quote required.",
};
