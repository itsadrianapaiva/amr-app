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
