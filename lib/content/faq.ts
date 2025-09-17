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
  title: "Got questions? We have answers.",
  subtitle:
    "Clear answers about booking, payment, VAT, delivery, and changes. If your question is not here, contact our team.",

  items: [
    {
      q: "How does instant booking work?",
      a: "Pick your machine, select dates, and pay full amount by card, multibanco or other options we have available via Stripe. We place a short checkout hold so those dates are reserved while you pay. As soon as payment succeeds your booking is confirmed and you will receive an email with your booking details and next steps.",
    },
    {
      q: "When is the deposit charged and refunded?",
      a: "The security deposit is collected at handover: when you pick up from us or when we deliver to your site. You can pay the deposit by card or cash. It is refunded after we receive the machine back and a quick inspection confirms everything is fine.",
    },
    {
      q: "What payment methods do you accept?",
      a: "Online checkout: debit and credit cards via Stripe including multibanco. In person at handover for the deposit: card or cash.",
    },
    {
      q: "How is VAT shown and charged?",
      a: "The price summary shows amounts before VAT and the total with VAT. You pay the full rental amount plus VAT at checkout. Stripe shows the VAT breakdown and your invoice reflects the same amounts.",
    },
    {
      q: "Delivery, collection, and return",
      a: "If you select Delivery, we take the machine to your site. If you also select Pickup, we collect it at the end. If Delivery is not selected you collect the machine from us; if Pickup is not selected you return it to our yard. Please add the job site address during checkout so we can plan logistics. Delivery and pickup fees may apply.",
    },
    {
      q: "Is an operator available?",
      a: "Yes. An on-site operator is a flat €350 per day for all machines. You can add this during checkout so it appears on your booking and invoice.",
    },
    {
      q: "Delivery, collection, and return",
      a: "If you select Delivery, we take the machine to your site. If you also select Pickup, we collect it at the end. If Delivery is not selected you collect the machine from us; if Pickup is not selected you return it to our yard. We ask for the job site address during checkout to plan logistics. Delivery and pickup fees may apply.",
    },
    {
      q: "What if the dates are taken while I am checking out?",
      a: "We prevent overlaps with active bookings. If another customer has a temporary hold on the same dates you will see it. When their hold expires you can try again.",
    },
    {
      q: "Can I change or cancel my booking?",
      a: "Yes. Timing matters for eligibility. Contact support and review our Terms for the full policy: /legal/terms.",
    },
    {
      q: "Minimum rental days",
      a: "Minimums vary by machine and are shown on each machine page. Checkout enforces the minimum automatically.",
    },
    {
      q: "How do I get my invoice?",
      a: "We email a tax invoice after payment. You can request a copy at any time from support@amr-rentals.com.",
    },
    {
      q: "Urgent problems and support",
      a: "Need support now or have questions? Contact our team through whatsapp or email support@amr-rentals.com and we will help you quickly.",
    },
  ],
};
