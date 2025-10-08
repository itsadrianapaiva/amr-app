"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { signToken } from "@/lib/security/hmac";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { verifyOpsPassword, type Role } from "@/lib/auth/ops-password";

function pickRole(input: string | null | undefined): Role | null {
  const v = (input || "").trim().toLowerCase();
  if (v === "exec" || v === "manager" || v === "managers") {
    return v === "exec" ? "exec" : "managers";
  }
  return null;
}

const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;

export async function loginAction(formData: FormData): Promise<void> {
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "").trim();
  const nextParam = String(formData.get("next") || "/ops-admin");
  const nextPath = nextParam.startsWith("/") ? nextParam : "/ops-admin";

  const fail = (msg: string): never => {
    const url = `/login?error=${encodeURIComponent(msg)}&next=${encodeURIComponent(nextPath)}`;
    redirect(url);
  };

  function assertRole(value: Role | null, msg: string): asserts value is Role {
    if (value === null) fail(msg);
  }
  function assertString(
    value: string | null | undefined,
    msg: string
  ): asserts value is string {
    if (!value) fail(msg);
  }

  // 1) Username → role
  const roleMaybe = pickRole(username);
  assertRole(roleMaybe, "Unknown user. Use exec or managers.");
  const role = roleMaybe;

  // 2) Basic password validation
  if (!password || password.length < 6) fail("Invalid password.");

  // 3) Verify against resolved bcrypt hash (canonical and legacy envs supported)
  let match = false;
  try {
    match = await verifyOpsPassword(role, password);
  } catch (e) {
    // Clear message if env missing or malformed
    fail("Login misconfigured: missing or invalid bcrypt hash.");
  }
  if (!match) fail("Invalid credentials.");

  // 4) Issue session cookie
  const secretMaybe = process.env.AUTH_COOKIE_SECRET;
  assertString(secretMaybe, "Server missing AUTH_COOKIE_SECRET.");
  const secret = secretMaybe.trim();

  const token = await signToken({ sub: role, role }, secret, DEFAULT_TTL_SECONDS);
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

  redirect(nextPath);
}

/**
 * Non-redirecting credential check for inline error UX.
 */
export async function authenticate(
  usernameInput: string,
  passwordInput: string
): Promise<
  | { ok: true; role: Role }
  | {
      ok: false;
      code: "INVALID_USERNAME" | "INVALID_PASSWORD" | "INVALID_CREDENTIALS" | "MISCONFIG";
      message: string;
    }
> {
  const username = (usernameInput || "").trim().toLowerCase();
  const password = (passwordInput || "").trim();

  const roleMaybe = pickRole(username);
  if (!roleMaybe) {
    return { ok: false, code: "INVALID_USERNAME", message: 'Invalid username. Use "exec" or "managers".' };
  }
  const role = roleMaybe;

  if (!password || password.length < 6) {
    return { ok: false, code: "INVALID_PASSWORD", message: "Invalid password." };
  }

  try {
    const match = await verifyOpsPassword(role, password);
    if (!match) {
      return { ok: false, code: "INVALID_CREDENTIALS", message: "Incorrect password." };
    }
  } catch {
    return { ok: false, code: "MISCONFIG", message: "Login misconfigured: missing bcrypt hash." };
  }

  return { ok: true, role };
}
