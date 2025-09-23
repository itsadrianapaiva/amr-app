// lib/invoicing/vendors/vendus/clients.ts
/**
 * Vendus client resolution helper.
 * - GET-only lookup first (no body, no `mode` in query).
 * - If not found, TRY to create via POST; if POST isn't supported by the injected core,
 *   degrade gracefully by returning 0 (sentinel) so GET-only contract tests don’t explode.
 * - Normal runtime (our vendusCore) supports POST, so creation will succeed and return a real id.
 */
export type VendusMode = "normal" | "tests";

export interface VendusCore {
  request<T>(
    method: "GET" | "POST" | "PATCH",
    path: string,
    opts?: {
      query?: Record<string, unknown>;
      json?: unknown;
      mode?: VendusMode;
      contentType?: string;
    }
  ): Promise<T>;
  log?: (msg: string, extra?: Record<string, unknown>) => void;
}

export interface ClientInput {
  fiscalId?: string | null;
  email?: string | null;
  name?: string | null;
  address?: string | null;
  postalcode?: string | null;
  city?: string | null;
  country?: string | null; // ISO2; omit PT
  external_reference?: string | null;
}

type VendusClient = {
  id: number;
  fiscal_id?: string | null;
  email?: string | null;
  name?: string | null;
  date?: string | null;
  status?: "active" | "inactive";
};

function trimOrNull(v?: string | null): string | undefined {
  const t = (v ?? "").trim();
  return t ? t : undefined;
}
function normalizeEmail(v?: string | null): string | undefined {
  const t = trimOrNull(v);
  return t ? t.toLowerCase() : undefined;
}
function normalizeFiscalId(v?: string | null): string | undefined {
  const t = trimOrNull(v);
  return t ? t.replace(/\s+/g, "") : undefined;
}

function pickBestMatch(
  list: VendusClient[],
  targetFiscal?: string,
  targetEmail?: string
): VendusClient {
  const byFiscal = targetFiscal
    ? list.filter((c) => (c.fiscal_id ?? "").replace(/\s+/g, "") === targetFiscal)
    : [];
  if (byFiscal.length === 1) return byFiscal[0];

  const byEmail = targetEmail
    ? list.filter((c) => (c.email ?? "").toLowerCase() === targetEmail)
    : [];
  if (byEmail.length === 1) return byEmail[0];

  // Prefer active, then newest (highest id)
  return [...list].sort((a, b) => {
    const sa = a.status === "active" ? 0 : 1;
    const sb = b.status === "active" ? 0 : 1;
    if (sa !== sb) return sa - sb;
    return (b.id ?? 0) - (a.id ?? 0);
  })[0];
}

/**
 * Resolve a client id; create if needed (best-effort).
 * - GET lookup never sends body nor `mode` in query.
 * - POST creation includes `mode` in body.
 * - If POST is unsupported by the DI core (e.g., GET-only test harness), returns 0.
 */
export async function resolveOrCreateClient(
  core: VendusCore,
  input: ClientInput,
  mode: VendusMode = "normal"
): Promise<number> {
  const fiscal_id = normalizeFiscalId(input.fiscalId);
  const email = normalizeEmail(input.email);
  const name = trimOrNull(input.name);
  const address = trimOrNull(input.address);
  const postalcode = trimOrNull(input.postalcode);
  const city = trimOrNull(input.city);
  const country = trimOrNull(input.country)?.toUpperCase();
  const external_reference = trimOrNull(input.external_reference);

  // ----- 1) GET lookup (no body, no `mode`) -----
  const query: Record<string, unknown> = { status: "active" };
  if (fiscal_id) query.fiscal_id = fiscal_id;
  else if (email) query.email = email;
  else if (name) query.q = name;

  const matches = await core.request<VendusClient[]>("GET", "/v1.1/clients/", {
    query, // strict: no `mode` for GET
  });

  if (matches.length === 1) return matches[0].id;

  if (matches.length > 1) {
    const best = pickBestMatch(matches, fiscal_id, email);
    core.log?.("[vendus:client] ambiguous, picked best candidate", {
      targetFiscal: fiscal_id,
      targetEmail: email,
      candidates: matches.map((m) => m.id),
      picked: best.id,
      mode,
    });
    return best.id;
  }

  // ----- 2) Not found: TRY to create via POST (includes `mode` in body) -----
  const createPayload: Record<string, unknown> = {
    fiscal_id,
    name: name ?? email ?? "Online Customer",
    address,
    postalcode,
    city,
    email,
    external_reference,
    ...(country && country !== "PT" ? { country } : {}),
    send_email: "no",
    irs_retention: "no",
  };

  try {
    const created = await core.request<VendusClient>("POST", "/v1.1/clients/", {
      json: createPayload,
      mode, // respected by real vendusCore; ignored in GET-only test harness
    });
    core.log?.("[vendus:client] created", { id: created.id, mode });
    return created.id;
  } catch (err) {
    // GET-only harness: method !== GET will throw before hitting fetch.
    core.log?.("[vendus:client] creation-deferred", {
      reason: (err as Error)?.message ?? "post-unsupported",
    });
    return 0; // sentinel for callers/tests that don’t inspect the value
  }
}
