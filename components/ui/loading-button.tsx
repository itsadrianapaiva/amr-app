"use client";

import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { ComponentProps, ReactNode } from "react";

/**
 * LoadingButton — drop-in submit button that shows a spinner
 * while a <form> is pending (supports Server Actions).
 */
type Props = {
  children: ReactNode;              // Button label
  loadingText?: string;             // Optional text while loading
} & Omit<ComponentProps<typeof Button>, "children">;

export default function LoadingButton({
  children,
  loadingText,
  ...btnProps
}: Props) {
  // useFormStatus() tells us if the nearest <form> is currently submitting
  const { pending } = useFormStatus();

  const label =
    pending && loadingText ? loadingText : children;

  return (
    <Button
      type="submit"
      aria-busy={pending ? "true" : "false"}
      aria-disabled={pending ? "true" : "false"}
      disabled={pending || btnProps.disabled}
      {...btnProps}
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          {/* Spinner icon from lucide-react */}
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>{label}</span>
        </span>
      ) : (
        children
      )}
    </Button>
  );
}
