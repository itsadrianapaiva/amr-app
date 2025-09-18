// Centralized, content-driven legal documents for AMR.
// We mirror common sections found in competitors' Privacy / Terms / Cookies pages,
// but the copy is original and lightweight for MVP. Fill optional fields if you later add phone support.

export type LegalLink = {
  label: string;
  href: string;
  external?: boolean;
};

export type LegalSection = {
  id: string;
  title: string;
  body: string[]; // paragraphs
};

export type LegalDoc = {
  id: "privacy" | "terms" | "cookies";
  title: string;
  lastUpdated: string; // ISO date string
  intro?: string;
  sections: LegalSection[];
  links?: LegalLink[];
};

export const LEGAL_LINKS = {
  // Official Portuguese electronic complaints book (Livro de Reclamações)
  complaintsBook: {
    label: "Livro de Reclamações",
    href: "https://www.livroreclamacoes.pt/inicio/",
    external: true,
  } as LegalLink,
};

// —————————————————————————————————————————————
// Privacy Policy (MVP)
// —————————————————————————————————————————————

export const LEGAL_PRIVACY: LegalDoc = {
  id: "privacy",
  title: "Privacy Policy",
  lastUpdated: "2025-09-17",
  intro:
    "This Privacy Policy explains how we collect and use your personal data when you browse our website and request rentals or support. It focuses on clarity and the minimum data we need to operate the service.",
  sections: [
    {
      id: "controller",
      title: "Data Controller",
      body: [
        'Company: Algarve Machinery Rental',
        'Registered address: Avenida da Liberdade, Centro Comercial Granjinhos, Loja 446, 4710-249, Braga, Portugal',
        'Warehouse address: Barranco da Vaca, 8670-116, Aljezur, Portugal',
        'Warehouse hours: Mo–Fr 08:00–19:00',
        'Website: https://amr-rentals.com',
        'Email: support@amr-rentals.com',
      ],
    },
    {
      id: "data-we-collect",
      title: "Data We Collect",
      body: [
        "Identification and contact: name, email, phone, optional company and tax ID (NIF) for invoicing.",
        "Booking details: selected machine, rental dates, delivery or pickup location and options.",
        "Payment metadata: online checkout status for the full rental amount via Stripe, and in-person deposit status at handover. We do not store card numbers on our servers.",
        "Basic device and usage data for security and service quality in aggregate form.",
      ],
    },
    {
      id: "purposes",
      title: "Purposes and Legal Bases",
      body: [
        "Contract performance and pre-contract steps: managing availability, bookings, handovers, returns, and support.",
        "Legitimate interests: fraud prevention, service improvement, and security.",
        "Legal obligations: invoicing, tax compliance, and record keeping.",
        "Consent: optional analytics or marketing if enabled in the future.",
      ],
    },
    {
      id: "processors",
      title: "Service Providers",
      body: [
        "Payments: Stripe (online checkout for rental charges; no card details stored on our servers).",
        "Hosting and infrastructure: reputable cloud providers used to run the website and APIs.",
        "Database: managed Postgres service used to store booking records.",
        "Email: transactional email provider used to send confirmations and invoices.",
        "These providers act under our instructions and appropriate data protection terms.",
      ],
    },
    {
      id: "transfers",
      title: "International Data Transfers",
      body: [
        "If data is processed outside the EEA, we rely on lawful transfer mechanisms such as Standard Contractual Clauses provided by our service providers.",
      ],
    },
    {
      id: "retention",
      title: "Retention",
      body: [
        "Booking and invoicing records are kept for the period required by law.",
        "Support messages are retained only as long as needed to resolve your request.",
      ],
    },
    {
      id: "security",
      title: "Security",
      body: [
        "We apply technical and organizational measures appropriate to the risk, including access controls and encryption in transit.",
      ],
    },
    {
      id: "rights",
      title: "Your Rights",
      body: [
        "You may request access, rectification, erasure, restriction, objection, or portability where applicable.",
        "To exercise rights, contact support@amr-rentals.com. You may also complain to the Portuguese supervisory authority (CNPD).",
      ],
    },
    {
      id: "cookies",
      title: "Cookies and Analytics",
      body: [
        'Essential cookies are used to deliver core functionality, including a consent cookie named "amr_consent" that records your choice.',
        "Analytics, if active, are used in aggregated form. See the Cookies Policy for details and controls.",
      ],
    },
  ],
  links: [LEGAL_LINKS.complaintsBook],
};

// —————————————————————————————————————————————
// Terms and Conditions (MVP)
// —————————————————————————————————————————————

export const LEGAL_TERMS: LegalDoc = {
  id: "terms",
  title: "Terms and Conditions",
  lastUpdated: "2025-09-17",
  intro:
    "These Terms govern the use of our website and the rental process. By requesting a booking, you accept these Terms.",
  sections: [
    {
      id: "scope",
      title: "Scope of Service",
      body: [
        "We provide an online interface to request rentals of machinery subject to availability and eligibility.",
        "A booking is confirmed when the full rental amount is successfully paid at checkout. Dates are then blocked.",
      ],
    },
    {
      id: "pricing",
      title: "Pricing and Taxes",
      body: [
        "The price summary shows amounts before VAT and the total with VAT. You pay the full rental amount plus VAT at checkout.",
        "Daily operator cost is €350 per day for all machines.",
        "Invoices reflect the VAT breakdown shown during checkout. Provide company name and NIF to receive a valid Portuguese invoice.",
      ],
    },
    {
      id: "deposit",
      title: "Security Deposit at Handover",
      body: [
        "A refundable security deposit is collected at handover, either when you pick up from our warehouse or when we deliver to your site.",
        "The deposit can be paid by card or cash at handover. It is refunded after the machine is returned and a quick inspection confirms no damage, loss, or extra charges.",
        "If paid by card, we initiate the refund promptly after inspection. The timing of funds availability depends on your bank or card issuer.",
      ],
    },
    {
      id: "booking",
      title: "Holds, Changes, and Cancellations",
      body: [
        "Checkout places a short hold on selected dates. If payment is not completed within the stated window, the hold expires and dates may become available to others.",
        "Changes or cancellations may be possible depending on timing. The policy communicated during checkout applies.",
      ],
    },
    {
      id: "delivery",
      title: "Delivery, Pickup, and Returns",
      body: [
        "If you select Delivery, we take the machine to your site. If you also select Pickup, we collect it at the end.",
        "If Delivery is not selected you collect the machine from our warehouse. If Pickup is not selected you return it to our warehouse within the agreed time.",
        "Delivery and pickup fees may apply. Ensure access and safe conditions at the site.",
      ],
    },
    {
      id: "responsibilities",
      title: "Customer Responsibilities",
      body: [
        "Provide accurate information, ensure site access, and follow safety instructions for transport and use.",
        "Use equipment in accordance with user guides and applicable law. You are responsible for custody of the machine during the rental period.",
      ],
    },
    {
      id: "liability",
      title: "Liability",
      body: [
        "We are not liable for indirect or consequential damages. Our total liability for any claim is limited to the amount paid for the affected rental.",
      ],
    },
    {
      id: "law",
      title: "Governing Law and Venue",
      body: [
        "These Terms are governed by Portuguese law. The courts of Braga have jurisdiction, without prejudice to mandatory rules that provide otherwise.",
      ],
    },
    {
      id: "changes",
      title: "Changes to the Terms",
      body: [
        "We may update these Terms. The version date appears at the top. Substantial changes will be highlighted on the site.",
      ],
    },
    {
      id: "complaints",
      title: "Complaints",
      body: [
        "You can submit a complaint via the official Portuguese electronic complaints book (Livro de Reclamações). See the link below.",
      ],
    },
  ],
  links: [LEGAL_LINKS.complaintsBook],
};

// —————————————————————————————————————————————
// Cookies Policy (MVP; adjust if analytics or marketing is enabled)
// —————————————————————————————————————————————

export const LEGAL_COOKIES: LegalDoc = {
  id: "cookies",
  title: "Cookies Policy",
  lastUpdated: "2025-09-17",
  intro: "This policy explains what cookies we use and how you can control them.",
  sections: [
    {
      id: "what-are-cookies",
      title: "What Are Cookies",
      body: [
        "Cookies are small text files placed on your device to store settings or identify your browser.",
      ],
    },
    {
      id: "types",
      title: "Types of Cookies We Use",
      body: [
        'Essential or functional: required for the site to work, including a consent cookie named "amr_consent" that records your choice.',
        "Analytics: used only if enabled. Collected in aggregated form to understand usage and improve the service.",
      ],
    },
    {
      id: "control",
      title: "How to Control Cookies",
      body: [
        "You can manage your choice using the cookie banner controls, or by adjusting your browser settings to block or delete cookies. Some features may not work correctly without essential cookies.",
      ],
    },
  ],
  links: [LEGAL_LINKS.complaintsBook],
};
