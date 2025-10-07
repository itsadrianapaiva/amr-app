"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { signToken } from "@/lib/security/hmac";
import { SESSION_COOKIE } from "@/lib/auth/session";

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

/** Robust env reader for bcrypt hashes.
 * Prefers base64 variants to avoid '$' expansion by env loaders.
 * Falls back to plain variables. Returns null if nothing usable was found.
 */
function readHashFromEnv(varPlain: string, varB64: string): string | null {
  // Read raw; DO NOT trim away trailing '=' padding
  const b64Raw = process.env[varB64] ?? "";
  if (b64Raw) {
    try {
      // Remove whitespace only (spaces/newlines) but preserve '=' padding
      const b64Clean = b64Raw.replace(/\s+/g, "");
      const decoded =
        typeof Buffer !== "undefined"
          ? Buffer.from(b64Clean, "base64").toString("utf8")
          : atob(b64Clean);
      // Only strip CR/LF that may sneak in from editors
      const bcrypt = decoded.replace(/[\r\n]+/g, "");
      if (bcrypt) return bcrypt;
    } catch {
      // fall through to plain
    }
  }
  // Plain fallback (trim spaces, but not needed for base64 path)
  const plain = (process.env[varPlain] || "").trim();
  return plain || null;
}

function getHashForRole(role: Role): string | null {
  if (role === "exec") {
    return readHashFromEnv("OPS_EXEC_BCRYPT", "OPS_EXEC_BCRYPT_B64");
  }
  return readHashFromEnv("OPS_MANAGERS_BCRYPT", "OPS_MANAGERS_BCRYPT_B64");
}

const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;

export async function loginAction(formData: FormData): Promise<void> {
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "").trim();
  const nextParam = String(formData.get("next") || "/ops-admin");

  // Only allow same-origin paths
  const nextPath = nextParam.startsWith("/") ? nextParam : "/ops-admin";

  // Redirect helper: never returns, so TS understands control flow stops here.
  const fail = (msg: string): never => {
    const url = `/login?error=${encodeURIComponent(msg)}&next=${encodeURIComponent(nextPath)}`;
    redirect(url);
  };

  // Type assertion helpers that *also* redirect on failure.
  function assertRole(value: Role | null, msg: string): asserts value is Role {
    if (value === null) fail(msg);
  }
  function assertString(
    value: string | null | undefined,
    msg: string
  ): asserts value is string {
    if (!value) fail(msg);
  }

  const roleMaybe = pickRole(username);
  assertRole(roleMaybe, "Unknown user. Use exec or managers.");
  const role = roleMaybe;

  const hashMaybe = getHashForRole(role);
  assertString(hashMaybe, "Login misconfigured: missing bcrypt hash.");
  const hash = hashMaybe.trim();

  // // ---- DEV/STAGING BYPASS (optional; remove later) ----
  // const passcode = (process.env.OPS_PASSCODE || "").trim();
  // if (passcode && password === passcode) {
  //   // Skip bcrypt entirely if a passcode is configured and matches.
  //   // Useful when hashes/env are acting up on preview/staging.
  //   const secret = (process.env.AUTH_COOKIE_SECRET || "").trim();
  //   assertString(secret, "Server missing AUTH_COOKIE_SECRET.");
  //   const token = await signToken(
  //     { sub: role, role },
  //     secret,
  //     DEFAULT_TTL_SECONDS
  //   );
  //   const secure = process.env.NODE_ENV === "production";
  //   cookies().set({
  //     name: SESSION_COOKIE,
  //     value: token,
  //     httpOnly: true,
  //     secure,
  //     sameSite: "lax",
  //     path: "/",
  //     maxAge: DEFAULT_TTL_SECONDS,
  //     expires: new Date(Date.now() + DEFAULT_TTL_SECONDS * 1000),
  //   });
  //   redirect(nextPath);
  // }
  // // -----------------------------------------------------

  if (!password || password.length < 6) fail("Invalid password.");

  console.log("[login debug]", {
    role,
    pw_len: password.length,
    pw_hex: Array.from(password)
      .map((c) => c.charCodeAt(0).toString(16))
      .join(" "),
    hash_len: hash.length,
    starts2b: hash.startsWith("$2b$") || hash.startsWith("$2a$"),
    secret_len: (process.env.AUTH_COOKIE_SECRET || "").trim().length,
  });

  const match = await bcryptCompare(password, hash);
  if (!match) fail("Invalid credentials.");

  const secretMaybe = process.env.AUTH_COOKIE_SECRET;
  assertString(secretMaybe, "Server missing AUTH_COOKIE_SECRET.");
  const secret = secretMaybe.trim();

  // Issue token and set cookie
  const token = await signToken(
    { sub: role, role },
    secret,
    DEFAULT_TTL_SECONDS
  );
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
 * Returns a structured result so the caller can map field errors.
 */
export async function authenticate(
  usernameInput: string,
  passwordInput: string
): Promise<
  | { ok: true; role: Role }
  | {
      ok: false;
      code:
        | "INVALID_USERNAME"
        | "INVALID_PASSWORD"
        | "INVALID_CREDENTIALS"
        | "MISCONFIG";
      message: string;
    }
> {
  const username = (usernameInput || "").trim().toLowerCase();
  const password = (passwordInput || "").trim();

  // Username → role
  const roleMaybe = pickRole(username);
  if (!roleMaybe) {
    return {
      ok: false,
      code: "INVALID_USERNAME",
      message: 'Invalid username. Use "exec" or "managers".',
    };
  }
  const role = roleMaybe;

  // Hash presence (env misconfig)
  const hashMaybe = getHashForRole(role);
  if (!hashMaybe) {
    return {
      ok: false,
      code: "MISCONFIG",
      message: "Login misconfigured: missing bcrypt hash.",
    };
  }
  const hash = hashMaybe.trim();

  // Basic password validation first (fast-fail)
  if (!password || password.length < 6) {
    return { ok: false, code: "INVALID_PASSWORD", message: "Invalid password." };
  }

  // Bcrypt compare
  const match = await bcryptCompare(password, hash);
  if (!match) {
    return {
      ok: false,
      code: "INVALID_CREDENTIALS",
      message: "Incorrect password.",
    };
  }

  return { ok: true, role };
}