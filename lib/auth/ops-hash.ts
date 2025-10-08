// lib/auth/ops-hash.ts
import "server-only";

export type Role = "exec" | "managers";

/** Simple bcrypt format check (modular-crypt, cost 04–31, 60 chars total). */
function isValidBcrypt(hash: string): boolean {
  // $2a$ / $2b$ / $2y$ + 2-digit cost + 53 base64 chars
  return /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(hash.trim());
}

/** Safe base64 decode (UTF-8). Returns null on errors. */
function b64decode(input: string | undefined): string | null {
  if (!input) return null;
  try {
    return Buffer.from(input, "base64").toString("utf8");
  } catch {
    return null;
  }
}

/** Env map per role (supports legacy and canonical names). */
function getEnvCandidates(
  role: Role
): Array<{ key: string; value?: string; decode?: boolean }> {
  if (role === "exec") {
    return [
      { key: "OPS_EXEC_HASH", value: process.env.OPS_EXEC_HASH },
      { key: "OPS_EXEC_BCRYPT", value: process.env.OPS_EXEC_BCRYPT },
      {
        key: "OPS_EXEC_BCRYPT_B64",
        value: process.env.OPS_EXEC_BCRYPT_B64,
        decode: true,
      },
    ];
  }
  return [
    { key: "OPS_MANAGERS_HASH", value: process.env.OPS_MANAGERS_HASH },
    { key: "OPS_MANAGERS_BCRYPT", value: process.env.OPS_MANAGERS_BCRYPT },
    {
      key: "OPS_MANAGERS_BCRYPT_B64",
      value: process.env.OPS_MANAGERS_BCRYPT_B64,
      decode: true,
    },
  ];
}

/**
 * Returns a usable bcrypt hash for the given role, checking:
 * 1) canonical HASH, 2) legacy BCRYPT, 3) legacy BCRYPT_B64 (decoded).
 */
export function getBcryptHashFor(role: Role): {
  hash: string | null;
  source: string | null;
} {
  const candidates = getEnvCandidates(role);
  for (const c of candidates) {
    let v = c.value ?? "";
    if (!v) continue;
    if (c.decode) v = b64decode(v) ?? "";
    if (isValidBcrypt(v)) return { hash: v, source: c.key };
  }
  return { hash: null, source: null };
}

/** Optional: expose which var is active for quick diagnostics. */
export function getOpsHashDebug() {
  const exec = getBcryptHashFor("exec");
  const managers = getBcryptHashFor("managers");
  return {
    exec: { has: !!exec.hash, source: exec.source },
    managers: { has: !!managers.hash, source: managers.source },
  };
}
