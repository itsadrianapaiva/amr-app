/**
 * Canonical resolver and verifier for Ops passwords.
 * Supports canonical and legacy env names, trims whitespace,
 * and accepts base64-encoded bcrypt strings.
 *
 * Canonical envs (preferred):
 *   OPS_EXEC_HASH
 *   OPS_MANAGERS_HASH
 *
 * Legacy fallbacks (will be ignored once we normalize prod/staging):
 *   OPS_EXEC_BCRYPT, OPS_EXEC_BCRYPT_B64
 *   OPS_MANAGERS_BCRYPT, OPS_MANAGERS_BCRYPT_B64
 */

export type Role = "exec" | "managers";

type EnvMap = {
  canonical: string[];
  legacy: string[];
};

const ENV_SOURCES: Record<Role, EnvMap> = {
  exec: {
    canonical: ["OPS_EXEC_HASH"],
    legacy: ["OPS_EXEC_BCRYPT", "OPS_EXEC_BCRYPT_B64"],
  },
  managers: {
    canonical: ["OPS_MANAGERS_HASH"],
    legacy: ["OPS_MANAGERS_BCRYPT", "OPS_MANAGERS_BCRYPT_B64"],
  },
};

/** Read and trim a process.env value safely. */
function readEnv(name: string): string | null {
  const raw = process.env[name];
  if (!raw) return null;
  // Trim whitespace and stray quotes users sometimes paste from dashboards
  const trimmed = raw.trim().replace(/^["'`]{1,2}|["'`]{1,2}$/g, "");
  return trimmed.length ? trimmed : null;
}

/** Heuristically detect base64: no '$' marker, only base64 charset, proper padding optional. */
function looksBase64(s: string): boolean {
  if (!s) return false;
  if (s.includes("$")) return false; // bcrypt always starts with $2
  // base64url or base64
  return /^[A-Za-z0-9+/_-]+={0,2}$/.test(s);
}

/** Normalize any provided string into a bcrypt string: decode base64 if needed. */
function normalizeToBcrypt(maybe: string): string {
  if (!maybe) return "";
  if (maybe.startsWith("$2a$") || maybe.startsWith("$2b$") || maybe.startsWith("$2y$")) {
    return maybe;
  }
  if (looksBase64(maybe)) {
    try {
      // Support both base64 and base64url encodings
      const normalized = maybe.replace(/-/g, "+").replace(/_/g, "/");
      const buf = Buffer.from(normalized, "base64");
      const decoded = buf.toString("utf8").trim();
      if (decoded.startsWith("$2")) return decoded;
    } catch {
      // fallthrough
    }
  }
  return maybe; // Let bcrypt fail loudly later if this isn't valid
}

/**
 * Resolve the bcrypt hash for a role.
 * Priority: canonical first, then legacy.
 */
export function resolveOpsHash(role: Role): string | null {
  const { canonical, legacy } = ENV_SOURCES[role];

  for (const key of [...canonical, ...legacy]) {
    const v = readEnv(key);
    if (v) {
      const norm = normalizeToBcrypt(v);
      return norm;
    }
  }
  return null;
}

/**
 * Verify a plaintext password against the resolved hash for the role.
 * Throws an explicit error if configuration is missing.
 */
export async function verifyOpsPassword(role: Role, plain: string): Promise<boolean> {
  const hash = resolveOpsHash(role);
  if (!hash) {
    // Helpful error that will surface in dev probe or server logs
    throw new Error(
      `Ops password not configured for role="${role}". Expected env: ` +
        ENV_SOURCES[role].canonical.join(" or "),
    );
  }
  const bcrypt = await import("bcryptjs");
  return bcrypt.compare(plain, hash);
}
