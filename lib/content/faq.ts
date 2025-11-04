/**
 * FAQ content for the landing page.
 * Keep copy here so marketing can tweak without touching components.
 */

export type FaqItem = {
  q: string;
  a: string;
};

export type FaqContent = {
  pretitle: string;
  title: string;
  subtitle: string;
  items: FaqItem[];
};

export const FAQ_CONTENT: FaqContent = {
  pretitle: "FAQ",
  title: "Learn how easy it is to rent online",
  subtitle:
    "Everything you need to know about instant booking, payments, IVA, delivery, and support.",

  items: [
    {
      q: "How does instant booking work?",
      a: "Choose your machine, select dates, and confirm online. The system blocks your dates while you pay securely through Stripe. As soon as payment succeeds, your booking is confirmed automatically and you’ll receive your invoice and instructions by email.",
    },
    {
      q: "Why do you only rent online?",
      a: "AMR is built to save time for both sides. Traditional rentals often require phone calls and manual quotes. Our system shows live availability and VAT-inclusive prices so you can book instantly without waiting for a reply.",
    },
    {
      q: "Is online payment secure?",
      a: "Yes. All payments go through Stripe — a global leader in secure transactions. Your card details are never stored on our servers, and every payment automatically generates a valid invoice.",
    },
    {
      q: "When is the deposit charged and refunded?",
      a: "The deposit is collected at handover — when you pick up or when we deliver. You can pay it by card or cash. It’s refunded right after we receive the machine back and inspection confirms everything is fine.",
    },
    {
      q: "Can I talk to someone before booking?",
      a: "Of course. You can reach our team by WhatsApp or email for any clarification before or after booking. We’re local and happy to help.",
    },
    {
      q: "Do you have physical offices?",
      a: "No. We’re fully digital to keep rentals fast and transparent. Our team operates from Aljezur and supports customers across the Algarve through delivery, pickup, and WhatsApp assistance.",
    },
    {
      q: "How is IVA handled?",
      a: "All prices are shown with and without IVA. The final total at checkout includes IVA, and your Stripe receipt and invoice show the full breakdown automatically.",
    },
    {
      q: "What if my preferred dates are taken?",
      a: "The system prevents overlaps. If another customer is holding the same dates, try again later — once their hold expires, availability updates automatically.",
    },
    {
      q: "Can I change or cancel a booking?",
      a: "Yes. Timing matters for eligibility, so contact support as soon as possible. You can find the full policy in our Terms at /legal/terms.",
    },
    {
      q: "Minimum rental period",
      a: "Each machine shows its minimum days. Checkout will enforce it automatically to avoid confusion.",
    },
    {
      q: "Do you provide operators?",
      a: "Yes. Add an on-site operator for €350/day directly in checkout so it appears on your booking and invoice.",
    },
    {
      q: "Delivery, pickup, and returns",
      a: "If you select Delivery, we bring the machine to your site. Pickup means we collect it when finished. You can also collect or return yourself — all options are shown clearly at checkout.",
    },
    {
      q: "Need urgent help?",
      a: "WhatsApp us at (+351) 934 014 611 or email support@amr-rentals.com. We respond quickly during working hours and monitor emergencies out of hours.",
    },
  ],
};
