// Explicit client-safe shape for machines crossing RSC/client boundaries.
// Decimal-like values are strings; nullable money stays `string | null`.
// No Prisma imports here to avoid coupling UI types to the DB schema.

export type SerializableMachine = {
  id: number;
  code: string;
  name: string;
  type: string;                 // keep UI-decoupled from Prisma enums
  description: string | null;
  imageUrl: string | null;
  weight: string | null;

  // Policy fields
  minDays: number;

  // Money/Decimal as strings (safe serialization, no float drift)
  dailyRate: string;
  deposit: string;
  deliveryCharge: string | null;
  pickupCharge: string | null;
};
