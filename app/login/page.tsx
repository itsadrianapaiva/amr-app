import "server-only";
import { loginAction } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: { next?: string };
}) {
  // Preserve ?next= so successful login bounces to the intended page.
  const nextPath =
    searchParams &&
    typeof searchParams.next === "string" &&
    searchParams.next.startsWith("/")
      ? searchParams.next
      : "/ops-admin";

  // Local server action wrapper: satisfies React's type constraint (Promise<void>)
  async function onSubmit(formData: FormData): Promise<void> {
    "use server";
    await loginAction(formData);
    // loginAction either redirects (success) or returns an error object (failure).
    // Returning void here satisfies the <form action> typing.
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl shadow-lg p-6 border">
        <h1 className="text-xl font-semibold mb-2">Ops Admin Login</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Username is your role: <code>exec</code> or <code>managers</code>.
        </p>

        {/* Server-only form: posts to our wrapper server action */}
        <form action={onSubmit} className="grid gap-4">
          <input type="hidden" name="next" value={nextPath} />

          <label className="grid gap-1">
            <span className="text-sm font-medium">Username</span>
            <input
              name="username"
              autoComplete="username"
              className="h-10 w-full rounded-md border px-3 text-sm"
              placeholder="exec or managers"
              required
            />
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
            />
          </label>

          <button
            type="submit"
            className="w-full rounded-lg h-10 px-4 border shadow-sm text-sm font-medium cursor-pointer text-primary-foreground hover:bg-primary/5"
          >
            Sign in
          </button>

          <p className="text-xs text-muted-foreground">
            On success you’ll be redirected to <code>{nextPath}</code>. If
            credentials are wrong, you’ll remain on this page. We’ll add inline
            error messages next.
          </p>
        </form>
      </div>
    </div>
  );
}
