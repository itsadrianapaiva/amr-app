import type { Machine } from "@prisma/client";
import type { SerializableMachine } from "@/lib/types";

/**
 * serializeMachine
 * Converts Prisma Decimal fields to strings so the result is
 * safe to send through React Server Components and props.
 */
export function serializeMachine(m: Machine): SerializableMachine {
  return {
    id: m.id, // number stays number
    name: m.name, // passthrough
    description: m.description, // passthrough
    imageUrl: m.imageUrl, // passthrough
    weight: m.weight, // passthrough
    dailyRate: m.dailyRate.toString(), // Decimal -> string
    deposit: m.deposit.toString(), // Decimal -> string
    deliveryCharge: m.deliveryCharge.toString(), // Decimal -> string
  };
}

/**
 * serializeMachines
 * Small helper to map arrays without repeating logic.
 */
export function serializeMachines(ms: Machine[]): SerializableMachine[] {
  return ms.map(serializeMachine);
}
