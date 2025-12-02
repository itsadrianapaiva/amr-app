/**
 * Trust partners content module.
 * Defines partner integrations and compliance messaging for homepage, checkout, and footer.
 */

export type TrustPartner = {
  /** Unique identifier for the trust partner. */
  id: "stripeSecure" | "vendusInvoice" | "ptVatCompliant" | "googleReviews";
  /** Short label describing the trust factor. */
  label: string;
  /** Longer description explaining the benefit. */
  description: string;
  /** Icon name for visual representation. */
  iconName: string;
  /** Whether to display on homepage trust section. */
  showOnHomepage: boolean;
  /** Whether to display on checkout page. */
  showOnCheckout: boolean;
  /** Whether to display in footer. */
  showOnFooter: boolean;
};

export const TRUST_PARTNERS: TrustPartner[] = [
  {
    id: "stripeSecure",
    label: "Secure online payments",
    description: "Card data is encrypted and processed safely through Stripe.",
    iconName: "lock",
    showOnHomepage: true,
    showOnCheckout: true,
    showOnFooter: false,
  },
  {
    id: "vendusInvoice",
    label: "Official VAT invoices",
    description:
      "Invoices are issued automatically through Vendus, with ATCUD included.",
    iconName: "document",
    showOnHomepage: true,
    showOnCheckout: true,
    showOnFooter: true,
  },
  {
    id: "ptVatCompliant",
    label: "Registered PT company",
    description:
      "Prices include 23 percent VAT according to Portuguese tax law.",
    iconName: "badge-check",
    showOnHomepage: true,
    showOnCheckout: true,
    showOnFooter: true,
  },
  {
    id: "googleReviews",
    label: "Reviewed by real customers",
    description:
      "Verified feedback from machinery rental clients on Google.",
    iconName: "star",
    showOnHomepage: true,
    showOnCheckout: false,
    showOnFooter: false,
  },
];
