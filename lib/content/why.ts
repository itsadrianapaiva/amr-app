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
  title: "Instant booking. Real time availability check. Transparent pricing in seconds.",
  paragraph:
    "Skip the calls. Our platform was made to make you life easier. You just need to select the machine you need, add the dates, choose extras and the price summary will show up immediately. Don't waste time, lock your rental in minutes. Local support from a team that actually knows job sites.",

  points: [
    {
      title: "Instant online booking",
      detail:
        "Pioneer in the Algarve with real instant checkout — no pre-request forms or waiting for callbacks.",
    },
    {
      title: "Transparent pricing",
      detail:
        "If you choose extras you see the price summary in real time, no need to call for a quote. No hidden fees.",
    },
    {
      title: "Delivery or pickup",
      detail:
        "We meet you where the work is. Flexible drop-off and collection windows, Algarve-wide.",
    },
    {
      title: "Secure payments",
      detail:
        "Stripe-powered checkout keeps your details safe and your booking confirmed the moment you pay. Deposits are at handover, either when you pick up or when we deliver.",
    },
  ],

  cta: { label: "Browse machines", href: "/#catalog" },

  // Set an image when ready, e.g. { src: "/assets/why.jpg", alt: "Excavator on site", width: 444, height: 492 }
  image: null,
};
