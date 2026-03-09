export type SocialProofContent = {
  title: string;
  pretitle: string;
  rating: number;
  ratingLabel: string;
  reviewCount: number;
  sourceLabel: string;
  ctaLabel: string;
  ctaHref: string;
  featuredReview: {
    quote: string;
    author: string;
    location: string;
    stars: number;
    contextLabel: string;
  };
};

export const SOCIAL_PROOF: SocialProofContent = {
  title: "What our customers say",
  pretitle: "Social proof",
  rating: 4.8,
  ratingLabel: "4.8 out of 5",
  reviewCount: 5,
  sourceLabel: "Google Reviews",
  ctaLabel: "See all reviews on Google",
  ctaHref: "",
  // Note: featuredReview is used as default copy and fallback.
  // The section now also reads from SOCIAL_PROOF_REVIEWS for rotating testimonials.
  featuredReview: {
    quote:
      "Great company, the only one in the Algarve that always shows up and does exactly what they promise. The machines are top notch and almost brand new.",
    author: "J. R.",
    location: "Aljezur",
    stars: 5,
    contextLabel: "Recent customer review",
  },
};
