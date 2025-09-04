// Centralized, content-driven legal documents for AMR.
// We mirror common sections found in competitors' Privacy / Terms / Cookies pages,
// but the copy is original and lightweight for MVP. Fill FILL_ME fields before launch.

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
    lastUpdated: "2025-09-02",
    intro:
      "This Privacy Policy explains how we collect and use your personal data when you browse our website and request rentals or support. It focuses on clarity and the minimum data we need to operate the service.",
    sections: [
      {
        id: "controller",
        title: "Data Controller",
        body: [
          "Company: Algarve Machinery Rental",
          "Address: Barranco da Vaca, Aljezur, Portugal",
          "Email: support@amr-rentals.com",
        ],
      },
      {
        id: "data-we-collect",
        title: "Data We Collect",
        body: [
          "Identification and contact: name, email, phone, optional company and tax ID for invoicing.",
          "Booking details: selected machine, rental dates, delivery/pickup site and options.",
          "Payment metadata: deposit payment status via our provider (no card numbers are stored on our servers).",
          "Basic device/usage data for security and analytics (aggregated).",
        ],
      },
      {
        id: "purposes",
        title: "Purposes & Legal Bases",
        body: [
          "Performing a contract or pre-contractual steps (managing bookings, support).",
          "Legitimate interests (fraud prevention, service improvement).",
          "Legal obligations (invoicing and tax compliance).",
          "Consent (e.g., optional marketing if ever enabled; not enabled in MVP).",
        ],
      },
      {
        id: "sharing",
        title: "Sharing",
        body: [
          "Service providers strictly necessary to operate the site (e.g., hosting, email, payments).",
          "Public authorities when required by law.",
          "We do not sell personal data.",
        ],
      },
      {
        id: "retention",
        title: "Retention",
        body: [
          "We keep booking and invoicing records for the period required by law.",
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
          "To exercise rights, contact us at support@amr-rentals.com. You can also complain to the supervisory authority (CNPD in Portugal).",
        ],
      },
      {
        id: "cookies",
        title: "Cookies & Analytics",
        body: [
          "Essential cookies are used to deliver core functionality (e.g., session).",
          "Analytics, if active, are used in aggregated form; see the Cookies Policy for details.",
        ],
      },
    ],
    links: [LEGAL_LINKS.complaintsBook],
  };
  
  // —————————————————————————————————————————————
  // Terms & Conditions (MVP)
  // —————————————————————————————————————————————
  
  export const LEGAL_TERMS: LegalDoc = {
    id: "terms",
    title: "Terms & Conditions",
    lastUpdated: "2025-09-02",
    intro:
      "These Terms govern the use of our website and the rental process. By requesting a booking, you accept these Terms.",
    sections: [
      {
        id: "scope",
        title: "Scope of Service",
        body: [
          "We provide an online interface to request rentals of machinery subject to availability and eligibility.",
          "A booking is only confirmed when payment of the deposit is successful and you receive confirmation.",
        ],
      },
      {
        id: "pricing",
        title: "Pricing & Taxes",
        body: [
          "Daily operator cost is €350/day for all machines (MVP rule).",
          "Totals shown at checkout exclude VAT (collected later for invoicing).",
        ],
      },
      {
        id: "booking",
        title: "Booking, Deposits & Cancellations",
        body: [
          "Holds may expire if payment is not completed within the stated window.",
          "Confirmed bookings may be cancelled per the policy communicated during checkout; refunds of deposits follow the same policy.",
        ],
      },
      {
        id: "responsibilities",
        title: "Customer Responsibilities",
        body: [
          "Provide accurate information and ensure site access and safety for delivery/pickup.",
          "Use equipment according to safety instructions and applicable law.",
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
        id: "changes",
        title: "Changes to the Terms",
        body: [
          "We may update these Terms; the version date appears at the top. Substantial changes will be highlighted on the site.",
        ],
      },
      {
        id: "complaints",
        title: "Complaints",
        body: [
          "You can submit a complaint via the official Portuguese electronic complaints book (Livro de Reclamações). See link below.",
        ],
      },
    ],
    links: [LEGAL_LINKS.complaintsBook],
  };
  
  // —————————————————————————————————————————————
  // Cookies Policy (optional for MVP; add if analytics/cookies used)
  // —————————————————————————————————————————————
  
  export const LEGAL_COOKIES: LegalDoc = {
    id: "cookies",
    title: "Cookies Policy",
    lastUpdated: "2025-09-02",
    intro:
      "This policy explains what cookies we use and how you can control them.",
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
          "Essential: required for the site to function (e.g., session).",
          "Analytics: help us understand usage (aggregated).",
        ],
      },
      {
        id: "control",
        title: "How to Control Cookies",
        body: [
          "You can configure your browser to block or delete cookies; some features may not work correctly without them.",
        ],
      },
    ],
    links: [LEGAL_LINKS.complaintsBook],
  };
  