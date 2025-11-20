/**
 * Social media links configuration.
 * Single source of truth for social channels used across nav, footer, and contact sections.
 */

export type SocialLink = {
  /** Unique identifier for the platform. */
  id: "facebook" | "instagram";
  /** Display label for accessibility. */
  label: string;
  /** Full URL to the social profile. */
  href: string;
};

/**
 * AMR social media profiles.
 * Rendered as icon links in nav, footer, and contact sections.
 */
export const SOCIAL_LINKS: SocialLink[] = [
  {
    id: "facebook",
    label: "Facebook",
    href: "https://facebook.com/amr.machineryrental",
  },
  {
    id: "instagram",
    label: "Instagram",
    href: "https://instagram.com/amr.machineryrental",
  },
];
