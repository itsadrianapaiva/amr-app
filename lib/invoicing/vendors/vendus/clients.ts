/**
 * Vendus client resolution helper.
 * Finds a unique client by fiscal_id (NIF) or email; if none, creates it; if many, picks the best match.
 * Keep pure and DI-friendly for unit testing.
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
  fiscalId?: string | null;     // PT NIF or foreign starting with ISO2
  email?: string | null;
  name?: string | null;
  address?: string | null;
  postalcode?: string | null;
  city?: string | null;
  country?: string | null;      // ISO2; omit for PT to avoid old API quirks
  external_reference?: string | null;
}

type VendusClient = {
  id: number;
  fiscal_id?: string | null;
  email?: string | null;
  name?: string | null;
  date?: string | null;         // creation date
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
    ? list.filter(c => (c.fiscal_id ?? "").replace(/\s+/g, "") === targetFiscal)
    : [];

  if (byFiscal.length === 1) return byFiscal[0];

  const byEmail = targetEmail
    ? list.filter(c => (c.email ?? "").toLowerCase() === targetEmail)
    : [];

  if (byEmail.length === 1) return byEmail[0];

  // Fallback heuristic: prefer active, then highest id (most recent)
  const activeFirst = [...list].sort((a, b) => {
    const sa = a.status === "active" ? 0 : 1;
    const sb = b.status === "active" ? 0 : 1;
    if (sa !== sb) return sa - sb;
    return (b.id ?? 0) - (a.id ?? 0);
  });
  return activeFirst[0];
}

/**
 * Resolve or create a client and return its Vendus ID.
 * Always returns a valid id or throws a descriptive error.
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

  // 1) Try to find existing clients with strong keys
  const query: Record<string, unknown> = { status: "active" };
  if (fiscal_id) query.fiscal_id = fiscal_id;
  else if (email) query.email = email;
  else if (name) query.q = name;

  const matches = await core.request<VendusClient[]>("GET", "/v1.1/clients/", {
    query,
    mode,
  });

  if (matches.length === 1) {
    return matches[0].id;
  }

  if (matches.length > 1) {
    const best = pickBestMatch(matches, fiscal_id, email);
    core.log?.("[vendus:client] ambiguous, picked best candidate", {
      targetFiscal: fiscal_id,
      targetEmail: email,
      candidates: matches.map(m => m.id),
      picked: best.id,
      mode,
    });
    return best.id;
  }

  // 2) None found: create a new client with the cleanest possible payload
  const createPayload: Record<string, unknown> = {
    fiscal_id,                   // required if PT; for foreign NIF, prefix with country
    name: name ?? email ?? "Online Customer",
    address,
    postalcode,
    city,
    email,
    external_reference,
    // Vendus accepts ISO2 here; some setups prefer omitting PT to avoid validation issues
    ...(country && country !== "PT" ? { country } : {}),
    send_email: "no",
    irs_retention: "no",
  };

  const created = await core.request<VendusClient>("POST", "/v1.1/clients/", {
    json: createPayload,
    mode,
  });

  core.log?.("[vendus:client] created", { id: created.id, mode });
  return created.id;
}
