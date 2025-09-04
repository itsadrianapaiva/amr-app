// Minimal smoke test: proves your Resend domain + key work end-to-end.
// Loads .env.local so it works outside Next.js runtime.
// Run with `npx tsx scripts/send-resend-test.ts`.

import { config } from 'dotenv'
config({ path: '.env.local' }) // load local env for scripts

import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM || 'noreply@send.amr-rentals.com';
const replyTo = process.env.EMAIL_REPLY_TO || 'support@amr-rentals.com';
const to = process.env.TEST_EMAIL_TO || 'amr.business.pt@gmail.com'; // change if needed

if (!apiKey) {
  console.error('Missing RESEND_API_KEY in env. Check .env.local and this script’s dotenv config.');
  process.exit(1);
}

async function main() {
  const resend = new Resend(apiKey);
  const subject = 'AMR test: Resend is live';
  const html =
    `<p>Hello from <strong>${from}</strong> → delivered to <strong>${to}</strong>.</p>` +
    `<p>Reply-To is set to <strong>${replyTo}</strong>.</p>`;

  const { data, error } = await resend.emails.send({
    from,
    to,
    subject,
    html,
    replyTo,
  });

  if (error) {
    console.error('Resend error:', error);
    process.exit(1);
  }

  console.log('Sent! id=', data?.id);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
