// Centralized, content-driven configuration for the Contacts section.
// Keep this pure and framework-agnostic so the UI can stay dumb and stable.

export type WhatsAppConfig = {
  /** E.164 format, e.g., '+351912345678' */
  e164: string;
  /** Human-friendly display, e.g., '(+351) 912 345 678' */
  display: string;
  /** Optional prefilled message (URL-encoded by the UI) */
  messageTemplate?: string;
};

export type LocationConfig = {
  label?: string; // e.g., 'Head Office'
  addressLine1: string | null;
  city: string;
  region?: string;
  postalCode?: string;
  country: string;
  /** A simple Google Maps URL (not an embed); the UI may turn this into a link. */
  mapsUrl?: string;
};

export type ContactContent = {
  id: "contact";
  pretitle: string;
  title: string;
  subtitle: string;
  support: {
    email: string;
    whatsapp: WhatsAppConfig;
    responseTimeNote?: string; // e.g., 'Mon–Fri, 09:00–18:00'
  };
  location: LocationConfig;
  form: {
    title: string;
    description: string;
    privacyNote?: string;
    /** Short success copy for optimistic/non-blocking forms */
    successNote?: string;
  };
};

export const CONTACTS: ContactContent = {
  id: "contact",
  pretitle: "Support & Enquiries",
  title: "Get in touch",
  subtitle:
    "Fast support via WhatsApp or email. Prefer a message? Use the short form and we’ll reply soon.",
  support: {
    // TODO: replace placeholders with real values.
    email: "support@amr-rentals.com",
    whatsapp: {
      e164: "+351934014611",
      display: "(+351) 934 014 611",
      messageTemplate: "Hello AMR, I need help with something else.",
    },
    responseTimeNote: "Mon–Fri, 09:00–17:00 (Lisbon)",
  },
  location: {
    label: "Head Office",
    addressLine1: "",
    city: "Aljezur",
    region: "Barranco da Vaca",
    postalCode: "8670-116",
    country: "Portugal",
    mapsUrl: "https://maps.app.goo.gl/cETjGMd9irmcvAj89", // simple link; no embed yet
  },
  form: {
    title: "Quick message",
    description:
      "Tell us your name, email, and what you need. We’ll get back shortly.",
    privacyNote:
      "We only use your data to respond to your enquiry. No spam, ever.",
    successNote: "Thanks. We’ll reply as soon as possible.",
  },
};
