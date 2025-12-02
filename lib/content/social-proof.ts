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
  ctaHref:
    "https://www.google.com/maps/place/AMR+-+Algarve+Machinery+Rental/@37.2680891,-8.8082611,17z/data=!4m8!3m7!1s0x2d1e8a709d7c67b1:0x589be09d3f5feca7!8m2!3d37.2680891!4d-8.8082611!9m1!1b1!16s%2Fg%2F11zk7wn4t9?entry=ttu&g_ep=EgoyMDI1MTEyMy4xIKXMDSoASAFQAw%3D%3D",
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
