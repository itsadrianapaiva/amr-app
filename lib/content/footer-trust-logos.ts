/**
 * Footer trust logos content module.
 * Defines logo metadata for the trust bar displayed above the copyright bar in the footer.
 */

export type FooterTrustLogo = {
  /** Unique identifier for the logo. */
  id:
    | "vendus"
    | "googleReviews"
    | "visa"
    | "mastercard"
    | "multibanco"
    | "poweredByStripe";
  /** Display label for the logo. */
  label: string;
  /** Path to the logo image. */
  imageSrc: string;
  /** Alt text for accessibility. */
  alt: string;
};

export const FOOTER_TRUST_LOGOS: FooterTrustLogo[] = [
  {
    id: "vendus",
    label: "Vendus",
    imageSrc: "/images/logos/cegid-vendus.png",
    alt: "Vendus invoicing platform logo",
  },
  {
    id: "googleReviews",
    label: "Google Reviews",
    imageSrc: "/images/logos/google-reviews.jpg",
    alt: "Google Reviews logo",
  },
  {
    id: "visa",
    label: "Visa",
    imageSrc: "/images/logos/visa.png",
    alt: "Visa payment logo",
  },
  {
    id: "mastercard",
    label: "Mastercard",
    imageSrc: "/images/logos/mastercard.png",
    alt: "Mastercard payment logo",
  },
  {
    id: "multibanco",
    label: "Multibanco",
    imageSrc: "/images/logos/multibanco.png",
    alt: "Multibanco payment option logo",
  },
  {
    id: "poweredByStripe",
    label: "Powered by Stripe",
    imageSrc: "/images/logos/powered-by-stripe.svg",
    alt: "Powered by Stripe secure payments logo",
  },
];
