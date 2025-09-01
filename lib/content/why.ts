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
  title: "Instant booking. Algarve-wide delivery. Pro-grade machinery.",
  paragraph:
    "Skip the quote dance. Pick dates, pay a deposit, and lock your rental in minutes. Local support from a team that actually knows job sites.",

  points: [
    {
      title: "Instant online booking",
      detail:
        "One of the few in the Algarve with real instant checkout — no pre-request forms or waiting for callbacks.",
    },
    {
      title: "Transparent pricing",
      detail:
        "Operator is a flat €350/day for any machine. Deposit secured at checkout. No hidden extras.",
    },
    {
      title: "Delivery or pickup",
      detail:
        "We meet you where the work is. Flexible drop-off and collection windows, Algarve-wide.",
    },
    {
      title: "Secure payments",
      detail:
        "Stripe-powered checkout keeps your details safe and your booking confirmed the moment you pay.",
    },
  ],

  cta: { label: "Browse machines", href: "/#catalog" },

  // Set an image when ready, e.g. { src: "/assets/why.jpg", alt: "Excavator on site", width: 444, height: 492 }
  image: null,
};
