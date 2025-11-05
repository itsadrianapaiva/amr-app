export type HowToBookContent = {
  pretitle: string;
  title: string;
  subtitle: string;
  /** Public iframe src for the video player (Synthesia). */
  videoEmbedSrc: string;
  /** Optional transcript for accessibility */
  transcript?: string | null;
  /** Preferred playback speed */
  preferredSpeed?: "1" | "1.25" | "1.5";
  /** Prefer closed captions on by default */
  preferCC?: boolean;
};

export const HOW_TO_BOOK: HowToBookContent = {
  pretitle: "All you need to know",
  title: "How to book with us",
  subtitle:
    "We want to make your rental experience easy and secure. Through this platform you have access to all the information you need to book your equipment today. Learn how easy it is to rent online.",
  videoEmbedSrc:
    "https://share.synthesia.io/embeds/videos/f0dceb8e-ae1e-4693-94a6-a72dda174f48",
  preferredSpeed: "1.25",
  preferCC: true,
  transcript: `Welcome to AMR Machinery Rentals! Booking your construction equipment online has never been easier.

Step 1: Browse our catalog and select the machine you need for your project.

Step 2: Choose your rental dates using our interactive calendar. You'll see real-time availability and pricing.

Step 3: Add delivery, pickup, insurance and operator options. We service the Algarve region with flexible logistics.

Step 4: Complete your booking with secure payment through Stripe. We accept card payments, MB WAY, and other methods.

Step 5: Receive instant confirmation via email with your booking details and invoice. Deposit will be collected at handover.

That's it! Your equipment will be ready when you need it. Let's get your project moving!`,
};
