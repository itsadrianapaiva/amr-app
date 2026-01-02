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

/** Check if running in production runtime (for graceful degradation). */
function isProdRuntime(): boolean {
  const env = process.env.NEXT_PUBLIC_ENV ?? process.env.NODE_ENV ?? "";
  return env.toLowerCase() === "production";
}

/**
 * serializeMachine
 * Convert Prisma Decimal fields into strings and pick only client-safe fields.
 * Keeps UI types decoupled from the DB schema.
 */
export function serializeMachine(m: Machine): SerializableMachine {
  // Runtime guard: Ensure code field is present (prevents silent fallbacks from partial selects)
  let code = m.code;
  if (!code || typeof code !== "string" || code.trim() === "") {
    const msg =
      `Machine ${m.id} (${m.name}) missing valid code field. ` +
      `Check that your query includes 'code' in the select statement or uses findMany/findUnique without a partial select.`;

    if (isProdRuntime()) {
      // Production: warn but don't crash (availability > correctness for this edge case)
      // Fallback to a safe dummy value to prevent type errors downstream
      console.warn(`[serializeMachine] ${msg} Using fallback code.`);
      code = `fallback-machine-${m.id}`;
    } else {
      // Dev/Staging: fail fast to catch during development
      throw new Error(msg);
    }
  }

  // Prefer new 'category'; fall back to legacy 'type'
  const category = readStringKey(m, "category");
  const legacyType: string = readStringKey(m, "type") ?? category ?? "";

  return {
    // primitives / nullable text
    id: m.id,
    code,
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
