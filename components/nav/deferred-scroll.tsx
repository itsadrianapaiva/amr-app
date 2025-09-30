"use client";

import { useEffect } from "react";
import { AMR_SCROLL_STORAGE_KEY } from "@/components/nav/scroll-link";

type Payload = { id: string; offset?: number; ts?: number };

function tryScroll(id: string, offset = 0): boolean {
  const el =
    document.getElementById(id) ||
    (document.querySelector(`[data-section="${id}"]`) as HTMLElement | null);

  if (!el) return false;

  const top = Math.max(
    0,
    el.getBoundingClientRect().top + window.scrollY - (offset ?? 0)
  );

  window.scrollTo({ top, behavior: "smooth" });
  // Focus for a11y if possible (won’t throw if not focusable)
  (el as HTMLElement).focus?.({ preventScroll: true });
  return true;
}

export default function DeferredScroll() {
  useEffect(() => {
    // 1) Read intent (if any)
    let payload: Payload | null = null;
    try {
      const raw = sessionStorage.getItem(AMR_SCROLL_STORAGE_KEY);
      if (raw) payload = JSON.parse(raw);
    } catch {
      // storage might be blocked; fail quietly
    }
    if (!payload?.id) return;

    const { id, offset = 0, ts = 0 } = payload;
    const tooOld = Date.now() - ts > 10_000; // ignore intents older than 10s
    if (tooOld) {
      sessionStorage.removeItem(AMR_SCROLL_STORAGE_KEY);
      return;
    }

    // 2) Attempt immediately
    if (tryScroll(id, offset)) {
      sessionStorage.removeItem(AMR_SCROLL_STORAGE_KEY);
      return;
    }

    // 3) Sections may be lazy-mounted — observe and retry briefly
    let done = false;

    const tryAndMaybeDone = () => {
      if (!done && tryScroll(id, offset)) {
        done = true;
        sessionStorage.removeItem(AMR_SCROLL_STORAGE_KEY);
        cleanup();
      }
    };

    // Retry on next ticks (quick ramp-up)
    const raf1 = requestAnimationFrame(tryAndMaybeDone);
    const raf2 = requestAnimationFrame(tryAndMaybeDone);

    // MutationObserver catches when the target element mounts
    const observer = new MutationObserver(() => tryAndMaybeDone());
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Hard stop after 3 seconds to avoid hanging observers
    const timeout = window.setTimeout(() => {
      if (!done) {
        sessionStorage.removeItem(AMR_SCROLL_STORAGE_KEY);
        cleanup();
      }
    }, 3000);

    function cleanup() {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      observer.disconnect();
      clearTimeout(timeout);
    }

    return cleanup;
  }, []);

  return null;
}
