"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";

type ScrollLinkProps = {
  to: string; // target section id, e.g. "catalog"
  offset?: number; // sticky header offset
  className?: string;
  ariaLabel?: string;
  onClick?: () => void;
  children: React.ReactNode;
};

const STORAGE_KEY = "amr:scrollTarget";

/**
 * Scroll to an element by id or [data-section="<id>"].
 * Returns true if scrolled locally, false if element not found.
 */
function tryLocalScroll(id: string, offset = 0): boolean {
  const el =
    document.getElementById(id) ||
    (document.querySelector(`[data-section="${id}"]`) as HTMLElement | null);

  if (!el) return false;

  const top = Math.max(
    0,
    el.getBoundingClientRect().top + window.scrollY - (offset ?? 0)
  );

  window.scrollTo({ top, behavior: "smooth" });
  // Optionally shift focus for a11y (if element is focusable)
  if ("focus" in el) {
    (el as HTMLElement).focus?.({ preventScroll: true });
  }
  return true;
}

export default function ScrollLink({
  to,
  offset = 0,
  className,
  ariaLabel,
  onClick,
  children,
}: ScrollLinkProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleClick = useCallback(() => {
    onClick?.();

    // 1) Try to scroll in-place
    if (tryLocalScroll(to, offset)) return;

    // 2) If target not present on this page and we are NOT on home,
    //    store intent and navigate to "/" without hash pollution.
    if (pathname !== "/") {
      try {
        sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ id: to, offset, ts: Date.now() })
        );
      } catch {
        // Storage may be disabled — ignore and just navigate home.
      }
      router.push("/", { scroll: true });
      return;
    }

    // 3) Already on "/" but target not mounted yet (lazy sections):
    //    store intent for when it mounts (home listener will consume it).
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ id: to, offset, ts: Date.now() })
      );
    } catch {
      // ignore
    }
  }, [to, offset, onClick, pathname, router]);

  // Render as a button to avoid <a> default behavior and keep URL clean.
  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={ariaLabel}
      className={className}
      data-scrolllink={to}
    >
      {children}
    </button>
  );
}

// Export the storage key so Home can implement a tiny "DeferredScroll" effect
export { STORAGE_KEY as AMR_SCROLL_STORAGE_KEY };
