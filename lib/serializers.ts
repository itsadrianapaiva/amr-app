// lib/serializers.ts
import type { Machine } from "@prisma/client";
import type { SerializableMachine } from "@/lib/types";

/** Read a string property safely from an unknown-ish object. */
function readStringKey(obj: unknown, key: string): string | undefined {
  if (obj && typeof obj === "object") {
    const r = obj as Record<string, unknown>;
    const v = r[key];
    if (typeof v === "string") return v;
  }
  return undefined;
}

/**
 * serializeMachine
 * Convert Prisma Decimal fields into strings and pick only client-safe fields.
 * Keeps UI types decoupled from the DB schema.
 */
export function serializeMachine(m: Machine): SerializableMachine {
  // Prefer new 'category'; fall back to legacy 'type'
  const category = readStringKey(m, "category");
  const legacyType: string = readStringKey(m, "type") ?? category ?? "";

  return {
    // primitives / nullable text
    id: m.id,
    code: m.code,
    name: m.name,

    // Back-compat: keep 'type' as strict string (empty string if absent)
    type: legacyType,

    // New field so the client can read category directly (optional)
    ...(category ? { category } : {}),

    description: m.description,
    imageUrl: m.imageUrl,
    weight: m.weight,

    // policy fields
    minDays: m.minDays,

    // Decimal -> string
    dailyRate: String(m.dailyRate),
    deposit: String(m.deposit),

    // Nullable Decimal -> string | null
    deliveryCharge: m.deliveryCharge != null ? String(m.deliveryCharge) : null,
    pickupCharge: m.pickupCharge != null ? String(m.pickupCharge) : null,
  };
}

/** Map helper to avoid repeating logic. */
export function serializeMachines(ms: Machine[]): SerializableMachine[] {
  return ms.map(serializeMachine);
}
