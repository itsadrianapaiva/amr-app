// Force dynamic rendering on staging so Netlify never serves stale cached HTML
// that references old chunk IDs. This matches ops-admin behavior.
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import "server-only";
import LoginForm from "@/components/auth/login-form";
import { loginAction, authenticate } from "./actions";

// Keep in sync with components/auth/login-form.tsx
type ErrorState =
  | {
      formError?: string;
      usernameError?: string;
      passwordError?: string;
    }
  | undefined;

/**
 * Ops Admin Login (server-only shell + client form)
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  // Accept only internal redirect targets.
  const resolvedParams = await searchParams;
  const nextParam =
    typeof resolvedParams?.next === "string" ? resolvedParams.next : "";
  const nextPath = nextParam.startsWith("/") ? nextParam : "/ops-admin";

  // (prevState, formData) => Promise<ErrorState>
  async function loginWithErrors(
    _prev: ErrorState,
    formData: FormData
  ): Promise<ErrorState> {
    "use server";

    // Normalize and pre-validate user inputs here for precise errors.
    const username = String(formData.get("username") ?? "").trim();
    const password = String(formData.get("password") ?? "").trim();
    if (!formData.get("next")) formData.set("next", nextPath);

    // Non-redirecting check: tells us exactly what failed.
    const result = await authenticate(username, password);

    if (result.ok) {
      // Success: issue cookie + redirect (never returns).
      await loginAction(formData);
      // If we ever return (unexpected), surface a safe form error.
      return { formError: "Login failed unexpectedly. Please try again." };
    }

    // Map error codes to field-level errors.
    switch (result.code) {
      case "INVALID_USERNAME":
        return { usernameError: result.message };
      case "INVALID_PASSWORD":
      case "INVALID_CREDENTIALS":
        return { passwordError: result.message };
      case "MISCONFIG":
      default:
        return {
          formError: result.message || "Login failed. Please try again.",
        };
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl shadow-lg p-6 border">
        <h1 className="text-xl font-semibold mb-2">Ops Admin Login</h1>

        <LoginForm nextPath={nextPath} action={loginWithErrors} />
      </div>
    </div>
  );
}
