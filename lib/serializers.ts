import type { Machine } from "@prisma/client";
import type { SerializableMachine } from "@/lib/types";

/**
 * serializeMachine
 * Convert Prisma Decimal fields into strings and pick only client-safe fields.
 * Keeps UI types decoupled from the DB schema.
 */
export function serializeMachine(m: Machine): SerializableMachine {
  // Prefer new 'category' (Prisma field renamed with @map("type")).
  // Keep legacy 'type' for any code still reading it.
  const category = (m as any).category ?? (m as any).type ?? null;
  const legacyType = (m as any).type ?? category ?? null;

  return {
    // primitives / nullable text
    id: m.id,
    name: m.name,
    // Back-compat: keep 'type' until all callsites migrate
    type: legacyType as any,
    // New field so the client can read category directly
    // (extra property is fine; SerializableMachine callers that don't use it can ignore)
    ...(category != null ? { category } : {}),

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
