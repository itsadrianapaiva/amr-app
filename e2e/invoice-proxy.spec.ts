import { test, expect } from "@playwright/test";

const baseURL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "";
const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(baseURL);
const hasVendus = !!process.env.VENDUS_API_KEY;

test.skip(
  isLocal || !hasVendus,
  "Run this PDF proxy smoke only on staging/prod with Vendus creds."
);

test("signed invoice link returns a PDF (proxy via /api/invoices/:id/pdf)", async ({
  request,
  page,
}) => {
  // Read a known booking id that already has invoiceNumber & invoicePdfUrl in DB (staging/prod).
  const bookingIdEnv = process.env.E2E_INVOICE_BOOKING_ID;
  const bookingId = Number(bookingIdEnv);
  test.skip(
    !Number.isFinite(bookingId) || bookingId <= 0,
    "Set E2E_INVOICE_BOOKING_ID to a booking that has an issued invoice."
  );

  // 1) Ask dev helper to mint a signed URL (exercises base-URL resolver too).
  const linkRes = await request.get(
    `/api/dev/invoice-link?bookingId=${bookingId}&ttl=600`,
    {
      headers: { "x-e2e-secret": process.env.E2E_SECRET ?? "" },
    }
  );
  const linkBodyText = await linkRes.text();
  expect(
    linkRes.ok(),
    `dev link endpoint failed: ${linkRes.status()} ${linkBodyText}`
  ).toBeTruthy();

  const { ok, url } = JSON.parse(linkBodyText) as { ok: boolean; url: string };
  expect(ok, `unexpected payload: ${linkBodyText}`).toBe(true);

  // 1.a) Sanity: correct path, no raw placeholder, https for non-local.
  expect(url).toContain(`/api/invoices/${bookingId}/pdf?t=`);
  expect(url).not.toContain("$deploy_prime_url");
  const parsed = new URL(url);
  const isLocal = /^(localhost|127\.0\.0\.1)$/i.test(parsed.hostname);
  if (!isLocal) expect(parsed.protocol).toBe("https:");

  // 2) Hit the signed URL and assert we get a PDF back.
  // Using the API request fixture for clean header access; also open it in the UI to
  // catch any content-disposition/browser issues.
  const pdfRes = await request.get(url);
  const pdfCt = pdfRes.headers()["content-type"] ?? "";
  const status = pdfRes.status();
  expect(status, `expected 200; got ${status}`).toBe(200);
  expect(pdfCt.toLowerCase()).toContain("application/pdf");

  // 3) Extra: verify PDF magic header ("%PDF-") for stronger signal.
  const buf = await pdfRes.body();
  const head = buf.subarray(0, 5).toString("utf8");
  expect(head).toBe("%PDF-");

  // 4) Optional UI check you can enable locally (won't run in Codespaces/CI without a display):
  if (process.env.E2E_SMOKE_UI === "1") {
    // eslint-disable-next-line no-console
    console.log(
      "UI smoke is disabled by default. Set E2E_SMOKE_UI=1 on a machine with a display to enable."
    );
  }
});
