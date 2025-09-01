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
    title: "Got questions? We’ve got answers.",
    subtitle:
      "Quick, honest answers about booking, deposits, delivery and changes. If you don’t see your question, reach out. We’re friendly.",
  
    items: [
      {
        q: "How does instant booking work?",
        a: "Choose your machine, pick dates, and pay the deposit via Stripe. We place a 30-minute hold while you complete checkout; once paid, your booking is confirmed immediately—no pre-request or callbacks.",
      },
      {
        q: "Is an operator available?",
        a: "Yes. An on-site operator is a flat €350/day for all machines. You’ll select this during checkout so it’s included in your booking.",
      },
      {
        q: "How is the deposit handled?",
        a: "The deposit is paid securely through Stripe during checkout. After successful payment your booking status switches to CONFIRMED and the hold timer is cleared.",
      },
      {
        q: "Do prices include VAT?",
        a: "Totals shown at checkout don’t include VAT in this MVP. We collect your business details and issue an invoice with VAT as required.",
      },
      {
        q: "Delivery or pickup—what do you need from me?",
        a: "Whether you choose delivery or pickup, we require the job site address during checkout so we can plan logistics and timing.",
      },
      {
        q: "What if the dates are already taken?",
        a: "Our system prevents overlaps for active bookings. If someone else is checking out the same dates, we’ll show it’s held and until what time; once their hold expires you can try again.",
      },
      {
        q: "Can I change or cancel my booking?",
        a: "Yes. Contact support and we’ll help. Deposit refunds and cut-offs depend on the final Terms & Conditions (publishing soon).",
      },
      {
        q: "Minimum rental days?",
        a: "Minimums vary by machine and are shown on each machine’s page. The checkout won’t let you pick fewer than the minimum.",
      },
    ],
  };
  