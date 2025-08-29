"use client";

import * as React from "react";

type Props = {
  show?: boolean;
  message?: string | null;
  /** Optional bullet list of messages. */
  items?: string[];
  kind?: "error" | "success" | "warning";
  /** Optional id so tests can target this block. */
  id?: string;
  className?: string;
};

/**
 * ErrorSummary
 * Reusable near-submit banner that:
 * - Only renders when `show` is truthy
 * - Auto-scrolls into view and receives focus when it appears
 * - Announces changes to screen readers via aria-live
 * Keep logic here so forms stay lean.
 */
export default function ErrorSummary({
  show = false,
  message,
  items,
  kind = "error",
  id = "error-summary",
  className = "",
}: Props) {
  const ref = React.useRef<HTMLDivElement>(null);

  // Compute visibility once per render
  const visible = !!show && (!!message || (items && items.length > 0));

  // Auto-scroll and focus when the summary becomes visible
  React.useEffect(() => {
    if (!visible || !ref.current) return;
    // Scroll to center for better context, then focus so SRs announce
    ref.current.scrollIntoView({ block: "center", behavior: "smooth" });
    // Focus without jumping again
    ref.current.focus({ preventScroll: true });
  }, [visible, message, items?.length]);

  if (!visible) return null;

  // Semantics and styles
  const isError = kind === "error" || kind === "warning";
  const role = isError ? "alert" : undefined; // alert implies assertive live region
  const ariaLive = isError ? "assertive" : "polite";

  const base =
    "rounded-md px-3 py-2 border text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2";
  const tone =
    kind === "success"
      ? "bg-green-50 border-green-200 text-green-900"
      : kind === "warning"
      ? "bg-amber-50 border-amber-200 text-amber-900"
      : "bg-red-50 border-red-200 text-red-900";

  return (
    <div
      id={id}
      ref={ref}
      tabIndex={-1}
      role={role}
      aria-live={ariaLive}
      className={`${base} ${tone} ${className}`}
    >
      {message ? <p className="font-medium">{message}</p> : null}
      {items && items.length > 0 ? (
        <ul className="mt-1 list-disc pl-5">
          {items.map((it, idx) => (
            <li key={idx}>{it}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
