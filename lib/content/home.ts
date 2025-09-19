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
  pretitle: "Instant online booking",
  title: "Rent pro-grade machinery in the Algarve",
  subtitle:
    "No quotes, no calls. Choose your machine, pick dates, pay a deposit. Delivery or pickup with local support.",

  primaryHref: "#catalog",
  primaryLabel: "Browse machines",

  // Set when ready to enable WhatsApp CTA, e.g. "+3519XXXXXXXX"
  whatsappNumberE164:"+351934014611",
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
  title: "All your site needs, a click away.",
  subtitle:
    "Explore robust, reliable machines. Book online in minutes, no pre-request required.",
};
