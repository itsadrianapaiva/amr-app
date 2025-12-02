/**
 * Payment method logos content module.
 * Defines payment options displayed on homepage and checkout.
 */

export type PaymentMethodLogo = {
  /** Unique identifier for the payment method. */
  id: "visa" | "mastercard" | "multibanco" | "poweredByStripe";
  /** Display label for the payment method. */
  label: string;
  /** Path to the logo image. */
  imageSrc: string;
  /** Alt text for accessibility. */
  alt: string;
};

export const PAYMENT_METHOD_LOGOS: PaymentMethodLogo[] = [
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
    alt: "Multibanco payment option",
  },
  {
    id: "poweredByStripe",
    label: "Powered by Stripe",
    imageSrc: "/images/logos/powered-by-stripe.svg",
    alt: "Powered by Stripe secure payment infrastructure",
  },
];
