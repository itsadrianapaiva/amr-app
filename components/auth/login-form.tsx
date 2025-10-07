"use client";

import { useFormState, useFormStatus } from "react-dom";

type ErrorState =
  | {
      formError?: string;
      usernameError?: string;
      passwordError?: string;
    }
  | undefined;

export default function LoginForm({
  nextPath,
  action, // (prevState, formData) => Promise<ErrorState>
}: {
  nextPath: string;
  action: (prevState: ErrorState, formData: FormData) => Promise<ErrorState>;
}) {
  const [state, formAction] = useFormState(action, undefined);
  const { pending } = useFormStatus();

  // Back-compat: if a previous version returned { error }, treat it as formError.
  const formError = (state as any)?.error ?? state?.formError;

  const usernameInvalid = Boolean(state?.usernameError);
  const passwordInvalid = Boolean(state?.passwordError);

  const ariaDescribedByUsername = [
    formError ? "login-error" : null,
    usernameInvalid ? "username-error" : null,
  ]
    .filter(Boolean)
    .join(" ") || undefined;

  const ariaDescribedByPassword = [
    formError ? "login-error" : null,
    passwordInvalid ? "password-error" : null,
  ]
    .filter(Boolean)
    .join(" ") || undefined;

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <input type="hidden" name="next" value={nextPath} />

      {/* Form-level error */}
      {formError && (
        <div
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
          id="login-error"
        >
          {formError}
        </div>
      )}

      <label className="grid gap-1">
        <span className="text-sm font-medium">Username</span>
        <input
          name="username"
          autoComplete="username"
          className="h-10 w-full rounded-md border px-3 text-sm"
          placeholder="exec or managers"
          required
          aria-invalid={usernameInvalid || undefined}
          aria-describedby={ariaDescribedByUsername}
        />
        {state?.usernameError && (
          <span
            id="username-error"
            className="text-xs text-red-700 mt-1"
            role="alert"
          >
            {state.usernameError}
          </span>
        )}
      </label>

      <label className="grid gap-1">
        <span className="text-sm font-medium">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          className="h-10 w-full rounded-md border px-3 text-sm"
          placeholder="••••••••"
          required
          minLength={6}
          aria-invalid={passwordInvalid || undefined}
          aria-describedby={ariaDescribedByPassword}
        />
        {state?.passwordError && (
          <span
            id="password-error"
            className="text-xs text-red-700 mt-1"
            role="alert"
          >
            {state.passwordError}
          </span>
        )}
      </label>

      <button
        type="submit"
        className="w-full rounded-lg h-10 px-4 border shadow-sm text-sm font-medium cursor-pointer text-primary-foreground hover:bg-primary/5 disabled:opacity-60"
        disabled={pending}
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>

      <p className="text-xs text-muted-foreground">
        On success you will be redirected to <code>{nextPath}</code>. Wrong
        credentials will show inline errors.
      </p>
    </form>
  );
}
