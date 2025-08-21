import type { Machine } from "@prisma/client";
import type { SerializableMachine } from "@/lib/types";

/**
 * serializeMachine
 * Converts Prisma Decimal fields to strings so the result is
 * safe to send through React Server Components and props.
 */
export function serializeMachine(m: Machine): SerializableMachine {
  return {
    // primitives passthrough
    id: m.id,
    name: m.name,
    type: m.type,
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
 * Small helper to map arrays without repeating logic.
 */
export function serializeMachines(ms: Machine[]): SerializableMachine[] {
  return ms.map(serializeMachine);
}
