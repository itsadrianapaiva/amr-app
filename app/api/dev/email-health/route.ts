// Dev-only healthcheck for the email subsystem. No secrets in response.

import { NextResponse } from "next/server";
import { emailsEnabled } from "@/lib/emails/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mask(v?: string | null) {
  if (!v) return null;
  // Obfuscate local-part to avoid leaking inboxes in logs/tools.
  const at = v.indexOf("@");
  return at > 1 ? `${v.slice(0, 2)}***${v.slice(at)}` : "***";
}

export async function GET() {
  const sendFlag = process.env.SEND_EMAILS === "true";
  const hasApiKey = !!process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? null;
  const replyTo = process.env.EMAIL_REPLY_TO ?? null;
  const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? null;

  return NextResponse.json(
    {
      ok: true,
      emailsEnabled: emailsEnabled(), // true only if key+from+SEND_EMAILS are set
      sendFlag,
      hasApiKey,
      from: mask(from),
      replyTo: mask(replyTo),
      appUrl,
      note:
        "emailsEnabled = hasApiKey && from && SEND_EMAILS==='true'. If false, app is in dry-run.",
    },
    { status: 200 }
  );
}
