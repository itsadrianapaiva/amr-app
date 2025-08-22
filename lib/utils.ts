import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Decimal } from "@prisma/client/runtime/library";

// This function from shadcn/ui is used to merge Tailwind CSS classes
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// This function formats a number as a currency string in EUR
export function formatCurrency(amount: number | string | Decimal) {
  const numericAmount = Number(amount);
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
  }).format(numericAmount);
}

/**
 * Display helper for optional money fields (DB Decimal | string | number | null).
 * - null/invalid → "Not available"
 * - 0 → "Included"
 * - >0 → formatted currency via formatCurrency
 */
export function moneyDisplay(val: unknown): string {
  if (val == null) return "Not available";
  const num = Number(val);
  if (Number.isNaN(num)) return "Not available";
  if (num === 0) return "Included";
  return formatCurrency(num);
}

// This function transforms a string so each word starts uppercase and the rest lowercase. Keeps punctuation like slashes and hyphens intact while capitalizing word starts.
export function toTitleCase(input: string): string {
  if (!input) return "";
  // Normalize whitespace and lowercase once
  const lower = input.toLowerCase().trim();

  // Split on spaces but preserve internal punctuation within words
  return lower
    .split(/\s+/)
    .map((word) =>
      // Capitalize first alphabetic character if present
      word.replace(/^([a-z])/, (m) => m.toUpperCase())
    )
    .join(" ");
}
