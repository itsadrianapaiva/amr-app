/**
 * Promo modal content config.
 * Centralizes marketing copy for the first-rental promotion.
 * Used in homepage modal to boost first-time conversions.
 */

export type PromoContent = {
  /** Main headline displayed in large text */
  title: string;
  /** Supporting sentence below the title */
  description: string;
  /** Label for the primary CTA leading to catalog or machines list */
  ctaBrowse: string;
  /** Label for the secondary CTA linking to Google reviews */
  ctaReviews: string;
  /** Small highlight text above title (e.g., “Limited-Time Offer”) */
  highlight: string;
  /** Short tagline or badge for optional UI use */
  badge: string;
  /** Legal disclaimer or small print text */
  legal: string;
};

/** Current active promo offer shown on homepage modal */
// export const PROMO_MODAL: PromoContent = {
//   title: "10% Off Your First Rental",
//   description:
//     "Check availability and prices directly on the chosen machine page — no need to call. At checkout, use promo code WELCOME10. ",
//   ctaBrowse: "Browse Catalog",
//   ctaReviews: "See Reviews on Google",
//   highlight: "Limited-Time Offer",
//   badge: "New Customer Offer",
//   legal:
//     "Valid for first-time rentals only. Use promo code WELCOME10 at Stripe checkout. Offer expires in 3 days or after 10 redemptions.",
// };

export const PROMO_MODAL: PromoContent = {
  title: "25% Off Algarve Rentals",
  description:
    "Prices shown already include the 25% reduction. Check availability on each machine page and confirm online in minutes.",
  ctaBrowse: "Browse Machines",
  ctaReviews: "See Reviews on Google",
  highlight: "Limited-Time Offer",
  badge: "Automatic Discount",
  legal:
    "Offer applies automatically to eligible rentals shown on the site. Subject to stock and scheduling.",
};
