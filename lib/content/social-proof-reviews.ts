// lib/content/social-proof-reviews.ts

/**
 * Social proof reviews used in the homepage "What our customers say" section.
 *
 * The SocialProofSection pairs these reviews with SOCIAL_PROOF_IMAGES by index:
 * slide 0 uses SOCIAL_PROOF_REVIEWS[0] and SOCIAL_PROOF_IMAGES[0],
 * slide 1 uses index 1, and so on.
 *
 * To add a new slide:
 * 1) Append a new review here.
 * 2) Append a matching image entry in lib/content/social-proof-images.ts
 *    at the same index.
 */

export type SocialProofReview = {
  id: string;
  quote: string;
  author: string;
  location: string;
  stars: number;
  contextLabel: string;
};

export const SOCIAL_PROOF_REVIEWS: SocialProofReview[] = [
  {
    id: "justin-rastegar",
    quote:
      "Great company, the only one in the Algarve that always shows up and does exactly what they promise. The machines are top notch and almost brand new.",
    author: "J. A.",
    location: "Aljezur",
    stars: 5,
    contextLabel: "Recent Google review",
  },
  {
    id: "paula-filipe",
    quote:
      "Excellent prices, well-maintained machines, and fast turnaround times. I recommend them.",
    author: "P. F.",
    location: "Vilamoura",
    stars: 5,
    contextLabel: "Google review",
  },
  {
    id: "andreza-clarine",
    quote:
      "5-star rating from a repeat customer who trusts our machines and service.",
    author: "A. C.",
    location: "Algarve",
    stars: 5,
    contextLabel: "Google rating",
  },
  {
    id: "simon-bowden",
    quote: "Helpful, understanding team and great service overall.",
    author: "S. B.",
    location: "Aljezur",
    stars: 5,
    contextLabel: "New Google review",
  },
  {
    id: "carol-andrade",
    quote:
      "Quick turnaround, safe and easy checkout process. I would rent with them again.",
    author: "C. A.",
    location: "Algarve",
    stars: 4,
    contextLabel: "Google review",
  },
  {
    id: "adriana-paiva",
    quote:
      "Everything was on time, the machine was reliable, and the team made sure the rental went smoothly from start to finish.",
    author: "A. A.",
    location: "Portimão",
    stars: 5,
    contextLabel: "Customer testimonial",
  },
];
