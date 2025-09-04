// Sends a real test email using the app's mailer. Dev-only, no secrets leaked.

import { NextResponse } from "next/server";
import { sendEmail, emailsEnabled } from "@/lib/emails/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mask(v?: string | null) {
  if (!v) return null;
  const at = v.indexOf("@");
  return at > 1 ? `${v.slice(0, 2)}***${v.slice(at)}` : "***";
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const to =
    url.searchParams.get("to") ??
    process.env.EMAIL_ADMIN_TO ??
    process.env.EMAIL_REPLY_TO ??
    "amr.business.pt@gmail.com";

  if (!emailsEnabled()) {
    return NextResponse.json(
      {
        ok: false,
        reason: "emailsDisabled",
        note: "Set SEND_EMAILS=true, RESEND_API_KEY and EMAIL_FROM.",
      },
      { status: 400 }
    );
  }

  const subject = "AMR test email from app route";
  const text = `This is a test sent by /api/dev/email-test at ${new Date().toISOString()}.\nTo: ${to}`;

  const res = await sendEmail({
    to,
    subject,
    text,
  });

  return NextResponse.json(
    {
      ok: res.ok,
      id: res.ok ? res.id : undefined,
      error: res.ok ? undefined : res.error,
      from: mask(process.env.EMAIL_FROM ?? null),
      replyTo: mask(process.env.EMAIL_REPLY_TO ?? null),
      to: mask(to),
    },
    { status: res.ok ? 200 : 500 }
  );
}
