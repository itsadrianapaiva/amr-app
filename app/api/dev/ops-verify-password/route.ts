export const dynamic = "force-dynamic";
export const revalidate = 0;
import "server-only";
import { NextResponse } from "next/server";
import { verifyOpsPassword, type Role } from "@/lib/auth/ops-password";

/** Report which env var is currently configured for the role (canonical first, then legacy). */
function usedEnvVarForRole(role: Role): string | null {
  const order =
    role === "exec"
      ? ["OPS_EXEC_HASH", "OPS_EXEC_BCRYPT", "OPS_EXEC_BCRYPT_B64"]
      : ["OPS_MANAGERS_HASH", "OPS_MANAGERS_BCRYPT", "OPS_MANAGERS_BCRYPT_B64"];

  for (const key of order) {
    const v = process.env[key];
    if (typeof v === "string" && v.trim().length > 0) return key;
  }
  return null;
}

/**
 * POST /api/dev/ops-verify-password
 * Headers: x-e2e-secret: <your E2E secret>
 * Body (JSON): { role: "exec" | "managers", password: "<plaintext>" }
 *
 * Returns 200 with { ok, role, usedEnvVar, match } (never echoes secrets).
 */
export async function POST(req: Request) {
  // 0) Guard: require secret header to prevent abuse.
  const hdr = req.headers.get("x-e2e-secret") ?? "";
  const expected = process.env.E2E_SECRET ?? "";
  if (!expected || hdr !== expected) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // 1) Parse body
  let role: Role;
  let password: string;
  try {
    const body = await req.json();
    role = body.role;
    password = body.password;
    if (role !== "exec" && role !== "managers") throw new Error("bad role");
    if (typeof password !== "string" || password.length === 0) throw new Error("bad password");
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-body" }, { status: 400 });
  }

  // 2) Identify which env var is set (helps diagnose prod/staging)
  const envVar = usedEnvVarForRole(role);
  if (!envVar) {
    return NextResponse.json(
      { ok: false, role, usedEnvVar: null, error: "hash-not-configured" },
      { status: 500 }
    );
  }

  // 3) Verify using the canonical resolver (same as the login flow)
  try {
    const match = await verifyOpsPassword(role, password);
    return NextResponse.json(
      { ok: true, role, usedEnvVar: envVar, match },
      { headers: { "cache-control": "no-store" } }
    );
  } catch {
    // Covers missing/invalid hash formats, base64 decode issues, etc.
    return NextResponse.json(
      { ok: false, role, usedEnvVar: envVar, error: "compare-failed" },
      { status: 500 }
    );
  }
}
