import type { Machine } from "@prisma/client";

// This type converts the Decimal fields of the Machine type into strings,
// making the data "serializable" and safe to pass from Server to Client Components.
export type SerializableMachine = Omit<
  Machine,
  "dailyRate" | "deposit" | "deliveryCharge"
> & {
  dailyRate: string;
  deposit: string;
  deliveryCharge: string;
};

