"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

type Props = {
  /** Visible label; defaults to "Print / Save PDF" */
  children?: React.ReactNode;
  /** Extra classes to position/size the button (e.g., "ml-auto") */
  className?: string;
};

/**
 * PrintButton
 * Minimal client-only button that triggers the browser print dialog.
 * Hidden when printing via `print:hidden`.
 */
export default function PrintButton({
  children = "Print / Save PDF",
  className,
}: Props) {
  function handleClick() {
    try {
      window.print();
    } catch {
      // no-op: printing isn't critical; we avoid throwing in the UI
    }
  }

  return (
    <Button
      type="button"
      onClick={handleClick}
      className={["print:hidden", className].filter(Boolean).join(" ")}
    >
      <Printer className="mr-2 h-4 w-4" />
      {children}
    </Button>
  );
}
