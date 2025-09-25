"use client";

import { useCallback } from "react";

type ScrollLinkProps = {
  /** Section id (without '#'). Example: "contact" */
  to: string;
  children: React.ReactNode;
  className?: string;
  /** Close sheets/menus after scroll (optional) */
  onClick?: () => void;
  /** Sticky header offset in px (e.g., 96–120) */
  offset?: number;
  /** "smooth" (default) or "auto" */
  behavior?: ScrollBehavior;
  /** Optional aria-label for accessibility */
  ariaLabel?: string;
};

/**
 * ScrollLink
 * JS on: prevents navigation, smooth-scrolls, keeps URL clean (no #).
 * JS off: still navigates via href (#) as a fallback.
 */
export default function ScrollLink({
  to,
  children,
  className,
  onClick,
  offset = 0,
  behavior = "smooth",
  ariaLabel,
}: ScrollLinkProps) {
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      // Keep URL clean by preventing default navigation
      e.preventDefault();

      // Prefer #id, fallback to [data-section="..."]
      let el = document.getElementById(to);
      if (!el) {
        el = document.querySelector<HTMLElement>(`[data-section="${CSS.escape(to)}"]`) || null;
      }

      if (!el) {
        // Helpful dev signal if the id mismatches
        // eslint-disable-next-line no-console
        console.warn(`[ScrollLink] No element found for id or data-section="${to}"`);
        return;
      }

      const rect = el.getBoundingClientRect();
      const absoluteTop = rect.top + window.scrollY - offset;

      // Smooth scroll without changing URL
      window.scrollTo({ top: absoluteTop, behavior });

      // Accessibility: shift focus to the section (does not re-scroll)
      window.setTimeout(() => {
        const prevTabIndex = el!.getAttribute("tabindex");
        el!.setAttribute("tabindex", "-1");
        el!.focus({ preventScroll: true });
        if (prevTabIndex === null) el!.removeAttribute("tabindex");
      }, behavior === "smooth" ? 300 : 0);

      onClick?.();
    },
    [to, offset, behavior, onClick]
  );

  // Fallback for no-JS environments still works
  const href = `/#${to}`;

  return (
    <a href={href} className={className} onClick={handleClick} aria-label={ariaLabel}>
      {children}
    </a>
  );
}
