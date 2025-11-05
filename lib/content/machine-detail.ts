/**
 * Machine detail page content and tiny helpers for specs.
 * Keep labels and microcopy here so we can tweak wording or localize without touching components.
 */

export type MachineDetailCopy = {
    pretitle: string; // small label above the machine header
  };
  
  export const MACHINE_DETAIL_COPY: MachineDetailCopy = {
    pretitle: "Book you machine now",
  };
  
  export type MachineSpecsCopy = {
    labels: {
      dailyRate: string;
      minimumRental: string;
      weight: string;
      deposit: string;
      deliveryCharge: string;
      pickupCharge: string;
    };
    // Tiny formatters keep wording consistent. Components still control data selection.
    formatMinimumRental: (days: number) => string;
    // Weight often comes as a free-text field; keep a safe fallback.
    formatWeight: (weight: string | null | undefined) => string;
    // For “Included / Not available / €X”, we’ll use the shared moneyDisplay in the component
    // and only prepend labels here if needed in the future.
  };
  
  export const MACHINE_SPECS_COPY: MachineSpecsCopy = {
    labels: {
      dailyRate: "Daily Rate",
      minimumRental: "Minimum Rental",
      weight: "Weight",
      deposit: "Deposit",
      deliveryCharge: "Delivery Charge",
      pickupCharge: "Pickup Charge",
    },
    formatMinimumRental: (days) => `${days} ${days === 1 ? "day" : "days"}`,
    formatWeight: (weight) => {
      const w = (weight ?? "").trim();
      return w.length ? w : "—";
    },
  };
  