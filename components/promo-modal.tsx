"use client";

import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogOverlay,
} from "@/components/ui/alert-dialog";
import { PROMO_MODAL } from "@/lib/content/promo";
import {
  PROMO_MODAL_ENABLED,
  PROMO_MODAL_SUPPRESS_DAYS,
  PROMO_GOOGLE_URL,
} from "@/lib/config";

const STORAGE_KEY = "amr:promo-modal:last-dismissed";
const OPEN_DELAY_MS = 1200;

/**
 * PromoModal - First-rental promotion modal for homepage.
 * Shows once per user with configurable suppression period.
 * Styled with black background and orange-red gradient border.
 */
export function PromoModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!PROMO_MODAL_ENABLED) return;

    const lastDismissed = localStorage.getItem(STORAGE_KEY);
    if (lastDismissed) {
      const dismissed = new Date(lastDismissed);
      const now = new Date();
      const daysSince =
        (now.getTime() - dismissed.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSince < PROMO_MODAL_SUPPRESS_DAYS) {
        return;
      }
    }

    const timer = setTimeout(() => {
      setOpen(true);
    }, OPEN_DELAY_MS);

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    setOpen(false);
  };

  const handleBrowse = () => {
    const catalog = document.getElementById("catalog");
    if (catalog) {
      catalog.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleReviews = () => {
    window.open(PROMO_GOOGLE_URL, "_blank", "noopener,noreferrer");
  };

  if (!PROMO_MODAL_ENABLED) return null;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogOverlay />
      <AlertDialogContent className="max-w-lg border-0 bg-black p-0">
        {/* Inner container with gradient border */}
        <div className="relative overflow-hidden rounded-lg">
          {/* Gradient border effect */}
          <div
            className="absolute inset-0 rounded-lg p-[2px]"
            style={{
              background: "linear-gradient(135deg, #FF4F00 0%, #FF8C00 100%)",
            }}
          >
            <div className="h-full w-full rounded-lg bg-black" />
          </div>

          {/* Content */}
          <div className="relative z-10 p-6">
            {/* Highlight badge */}
            <div className="mb-3 text-center">
              <span className="inline-block rounded-full bg-gradient-to-r from-[#FF4F00] to-[#FF8C00] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                {PROMO_MODAL.highlight}
              </span>
            </div>

            <AlertDialogHeader className="space-y-3">
              <AlertDialogTitle className="text-center text-2xl font-bold text-white sm:text-3xl">
                {PROMO_MODAL.title}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-center text-base text-gray-300">
                {PROMO_MODAL.description}
              </AlertDialogDescription>
            </AlertDialogHeader>

            {/* CTAs */}
            <AlertDialogFooter className="mt-6 flex-col gap-3 sm:flex-col">
              {/* Keep Action for Browse Machines so it closes + suppresses */}
              <AlertDialogAction
                onClick={handleBrowse}
                className="w-full bg-gradient-to-r from-[#FF4F00] to-[#FF8C00] text-white hover:opacity-90"
              >
                {PROMO_MODAL.ctaBrowse}
              </AlertDialogAction>

              {/* Use a plain link so the dialog stays open */}
              <a
                href={PROMO_GOOGLE_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleReviews}
                className="inline-flex w-full items-center justify-center rounded-md border border-gray-600 bg-transparent px-4 py-2 text-white hover:bg-gray-900"
              >
                {PROMO_MODAL.ctaReviews}
              </a>
            </AlertDialogFooter>

            {/* Legal disclaimer */}
            <p className="mt-4 text-center text-xs text-gray-500">
              {PROMO_MODAL.legal}
            </p>

            {/* Dismiss link as plain underline text, not a button variant */}
            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={handleDismiss}
                className="bg-transparent p-0 text-xs text-neutral-400 underline underline-offset-4 hover:text-neutral-200 focus:outline-none"
                aria-label="Do not show this promotion again"
              >
                Don’t show again
              </button>
            </div>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
