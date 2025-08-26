import type { Machine } from "@prisma/client";
import type { SerializableMachine } from "@/lib/types";

/**
 * serializeMachine
 * Convert Prisma Decimal fields into strings and pick only client-safe fields.
 * Keeps UI types decoupled from the DB schema.
 */
export function serializeMachine(m: Machine): SerializableMachine {
  return {
    // primitives / nullable text
    id: m.id,
    name: m.name,
    type: m.type, // Prisma enum is a string union; safe for our `string` UI type
    description: m.description,
    imageUrl: m.imageUrl,
    weight: m.weight,

    // policy fields
    minDays: m.minDays,

    // Decimal -> string
    dailyRate: m.dailyRate.toString(),
    deposit: m.deposit.toString(),

    // Nullable Decimal -> string | null
    deliveryCharge:
      m.deliveryCharge != null ? m.deliveryCharge.toString() : null,
    pickupCharge: m.pickupCharge != null ? m.pickupCharge.toString() : null,
  };
}

/**
 * serializeMachines
 * Map helper to avoid repeating logic.
 */
export function serializeMachines(ms: Machine[]): SerializableMachine[] {
  return ms.map(serializeMachine);
}
