import type { Machine } from "@prisma/client";

// Converts Prisma Decimal fields to strings for safe RSC serialization.
// deliveryCharge and pickupCharge are nullable in the DB, so they serialize to string | null.
export type SerializableMachine = Omit<
  Machine,
  "dailyRate" | "deposit" | "deliveryCharge" | "pickupCharge"
> & {
  dailyRate: string;
  deposit: string;
  deliveryCharge: string | null;
  pickupCharge: string | null;
};
