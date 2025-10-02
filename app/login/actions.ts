"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { signToken } from "@/lib/security/hmac";
import { SESSION_COOKIE } from "@/lib/auth/session";

/**
 * Minimal bcrypt compare using bcryptjs (pure JS, no native builds).
 * We import lazily to avoid pulling it into the Edge bundle.
 */
async function bcryptCompare(plain: string, hash: string): Promise<boolean> {
  const bcrypt = await import("bcryptjs");
  return bcrypt.compare(plain, hash);
}

type Role = "exec" | "managers";

function pickRole(input: string | null | undefined): Role | null {
  const v = (input || "").trim().toLowerCase();
  if (v === "exec" || v === "manager" || v === "managers") {
    return v === "exec" ? "exec" : "managers";
  }
  return null;
}

function getHashForRole(role: Role): string | null {
  if (role === "exec") return process.env.OPS_EXEC_BCRYPT ?? null;
  return process.env.OPS_MANAGERS_BCRYPT ?? null;
}

const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;

export async function loginAction(formData: FormData) {
  const username = String(formData.get("username") || "");
  const password = String(formData.get("password") || "");
  const nextPath = String(formData.get("next") || "/ops-admin");

  const role = pickRole(username);
  if (!role) {
    return { ok: false as const, error: "Unknown user. Use exec or managers." };
  }

  const hash = getHashForRole(role);
  if (!hash) {
    return { ok: false as const, error: "Login is misconfigured. Missing bcrypt hash." };
  }

  if (!password || password.length < 6) {
    return { ok: false as const, error: "Invalid password." };
  }

  const match = await bcryptCompare(password, hash);
  if (!match) {
    return { ok: false as const, error: "Invalid credentials." };
  }

  const secret = process.env.AUTH_COOKIE_SECRET;
  if (!secret) {
    return { ok: false as const, error: "Server missing AUTH_COOKIE_SECRET." };
  }

  // Issue token (DRY with our HMAC helper). We set the cookie via Next's cookies API.
  const token = await signToken({ sub: role, role }, secret, DEFAULT_TTL_SECONDS);

  // Cookie settings mirror our session module policy.
  const secure = process.env.NODE_ENV === "production";
  cookies().set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: DEFAULT_TTL_SECONDS,
    expires: new Date(Date.now() + DEFAULT_TTL_SECONDS * 1000),
  });

  // Safe redirect target: only allow same-origin paths.
  const target = nextPath.startsWith("/") ? nextPath : "/ops-admin";
  redirect(target);
}
