// Tiny banner shown after the SCA fallback completes (success page with ?auth=1).
// Pure UI, safe in Server Components.

type Props = {
  /** Control visibility (e.g., searchParams.auth === "1"). */
  visible: boolean;
  /** Optional amount (euros) to display “up to €X” in the message. */
  amountEuros?: number;
};

export default function AuthVerifiedBanner({ visible, amountEuros }: Props) {
  if (!visible) return null;

  const amount =
    typeof amountEuros === "number" ? ` up to €${amountEuros.toFixed(2)}` : "";

  return (
    <div className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-900">
      <p className="font-medium">Card verified — no additional charge today.</p>
      <p className="text-sm opacity-80">
        A temporary authorization{amount} may appear. We only capture the
        balance after your rental if needed.
      </p>
    </div>
  );
}
