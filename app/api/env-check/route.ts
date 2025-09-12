import { NextResponse } from "next/server";

/**
 * Safe picker to avoid leaking secrets. Only include the whitelisted keys.
 */
function pickEnv(keys: string[]) {
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = process.env[k];
    if (typeof v !== "undefined" && v !== "") out[k] = v;
  }
  return out;
}

export async function GET(req: Request) {
  const currentOrigin = new URL(req.url).origin;

  // Only safe, non-secret values:
  const urls = pickEnv(["APP_URL", "NEXT_PUBLIC_APP_URL"]);
  const netlify = pickEnv(["CONTEXT", "NETLIFY", "URL", "DEPLOY_URL", "DEPLOY_PRIME_URL"]);
  const node = pickEnv(["NODE_ENV"]);

  const payload = {
    now: new Date().toISOString(),
    currentOrigin,              // The origin serving this request (ground truth)
    urls,                       // What your app THINKS the base URLs are
    netlify,                    // Netlify context hints (if running on Netlify)
    node,                       // Node env
    mismatch: {
      appUrl_vs_currentOrigin:
        (process.env.APP_URL ?? "") !== currentOrigin,
      publicUrl_vs_currentOrigin:
        (process.env.NEXT_PUBLIC_APP_URL ?? "") !== currentOrigin,
    },
    tips: [
      "If mismatch is true: check netlify.toml context blocks for APP_URL/NEXT_PUBLIC_APP_URL.",
      "On Deploy Previews/Branch Deploys, APP_URL should resolve to https://$DEPLOY_PRIME_URL at build time.",
      "Never put Stripe sk_* or whsec_* in NEXT_PUBLIC_* vars.",
    ],
  };

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
