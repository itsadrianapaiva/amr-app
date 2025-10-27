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
export const PROMO_MODAL: PromoContent = {
  title: "10% Off Your First Rental — Limited-Time Offer",
  description:
    "Secure, professional equipment rental trusted by builders across the Algarve.",
  ctaBrowse: "Browse Machines",
  ctaReviews: "See Reviews on Google",
  highlight: "Limited-Time Offer",
  badge: "New Customer Offer",
  legal:
    "Valid for first-time rentals only. Use promo code WELCOME10 at checkout. Offer expires in 7 days or after 10 redemptions.",
};
