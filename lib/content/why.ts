/**
 * "Why book with us" section content.
 * Keep this copy here so marketing can tweak without touching components.
 */

export type WhyPoint = {
  title: string;
  detail: string;
};

export type WhyContent = {
  /** Small pretitle above the heading. */
  pretitle: string;
  /** Main heading. Keep concise for quick scanning. */
  title: string;
  /** Short supporting paragraph under the heading. */
  paragraph: string;
  /** 3–4 value props shown as a list. */
  points: WhyPoint[];
  /** Primary CTA at the end of the block. */
  cta: { label: string; href: string };
  /**
   * Optional image (right column). Omit to render a simple accent block placeholder.
   * Provide /public-relative paths (e.g. '/assets/why.jpg').
   */
  image?: { src: string; alt: string; width?: number; height?: number } | null;
};

export const WHY_BOOK: WhyContent = {
  pretitle: "Why book with us",
  title: "Instant booking. Live availability. Transparent prices.",
  paragraph:
    "Skip the back and forth. Pick your machine, select dates, and confirm online. Prices update as you add extras. Local support when you need it.",

  points: [
    {
      title: "Instant online booking",
      detail:
        "Real-time availability and confirmation. No request forms or waits.",
    },
    {
      title: "Transparent pricing",
      detail: "VAT-inclusive totals shown before you pay. No hidden fees.",
    },
    {
      title: "Delivery or pickup",
      detail:
        "Algarve-wide delivery windows or collect from our yard. Clear fees at checkout.",
    },
    {
      title: "Secure payments",
      detail:
        "Stripe checkout protects your details. Invoice sent automatically after payment. Deposit is collected at handover.",
    },
  ],

  cta: { label: "Book Online Now", href: "/#catalog" },

  // Set an image when ready, e.g. { src: "/assets/why.jpg", alt: "Excavator on site", width: 444, height: 492 }
  image: null,
};
