export const dynamic = "force-dynamic";       
export const revalidate = 0;                 
import "server-only";
import { NextResponse } from "next/server";
import { getBcryptHashFor, type Role } from "@/lib/auth/ops-hash";

async function bcryptCompare(plain: string, hash: string): Promise<boolean> {
  const bcrypt = await import("bcryptjs");
  return bcrypt.compare(plain, hash);
}

/**
 * POST /api/dev/ops-verify-password
 * Headers: x-e2e-secret: <your E2E secret>
 * Body (JSON): { role: "exec" | "managers", password: "<plaintext>" }
 *
 * Returns 200 with { ok: boolean, role, usedEnvVar }.
 * Never echoes the password or the hash.
 */
export async function POST(req: Request) {
  // 0) Guard: require secret header to prevent abuse.
  const hdr = req.headers.get("x-e2e-secret") ?? "";
  const expected = process.env.E2E_SECRET ?? "";
  if (!expected || hdr !== expected) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // 1) Parse body
  let role: "exec" | "managers";
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

  // 2) Resolve which env var to use
  const envVar = role === "exec" ? "OPS_EXEC_HASH" : "OPS_MANAGERS_HASH";
  const hash = process.env[envVar] ?? "";

  if (!hash) {
    return NextResponse.json(
      { ok: false, role, usedEnvVar: envVar, error: "hash-not-configured" },
      { status: 500 }
    );
  }

  // 3) Compare
  let match = false;
  try {
    match = await bcryptCompare(password, hash);
  } catch {
    return NextResponse.json(
      { ok: false, role, usedEnvVar: envVar, error: "compare-failed" },
      { status: 500 }
    );
  }

  // 4) Return result (no secrets echoed)
  return NextResponse.json(
    { ok: true, role, usedEnvVar: envVar, match },
    { headers: { "cache-control": "no-store" } }
  );
}
