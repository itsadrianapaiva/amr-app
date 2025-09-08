// "Outside service area" banner with Email + WhatsApp actions.
// Pure presentational: builds links from props, no RHF or env reads.
"use client";

import * as React from "react";

type Props = {
  /** Controls visibility (e.g., derived from root form error substring match). */
  visible: boolean;
  /** Support email to contact (e.g., NEXT_PUBLIC_SUPPORT_EMAIL). */
  supportEmail: string;
  /** WhatsApp number in E.164 digits without '+' (e.g., '351912345678'). */
  whatsappNumber: string;
  /** Human-friendly address string (e.g., "Rua X, 8000-000 Faro, Portugal"). */
  address: string;
  /** Optional chosen rental dates for context. */
  dateFrom?: Date | null;
  dateTo?: Date | null;
  /** Machine id for context in the message. */
  machineId: number;
};

function fmtLisbon(d?: Date | null): string {
  if (!d) return "";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Lisbon",
  });
}

export default function OutOfAreaBanner({
  visible,
  supportEmail,
  whatsappNumber,
  address,
  dateFrom,
  dateTo,
  machineId,
}: Props) {
  if (!visible) return null;

  const subject = "Rental request outside service area";
  const lines = [
    "Hello AMR,",
    "",
    "We’d like to rent outside your current service area.",
    `Address: ${address}`,
    `Dates: ${fmtLisbon(dateFrom)} → ${fmtLisbon(dateTo)}`,
    `Machine ID: ${machineId}`,
    "",
    "Could you advise on availability or a partner referral?",
  ];

  const body = encodeURIComponent(lines.join("\n"));
  const mailtoHref = `mailto:${encodeURIComponent(
    supportEmail
  )}?subject=${encodeURIComponent(subject)}&body=${body}`;

  const whatsappText = encodeURIComponent(lines.join("\n"));
  const whatsappHref = `https://wa.me/${whatsappNumber}?text=${whatsappText}`;

  return (
    <div
      role="alert"
      className="mt-4 rounded-lg border border-red-700 bg-red-50 p-4 text-sm"
    >
      <p className="font-medium">Outside our service area</p>
      <p className="mt-1">
        We currently serve Algarve up to Faro and the Alentejo coastal strip
        (Sines → Zambujeira do Mar). For exceptions or referrals, contact us:
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <a
          href={mailtoHref}
          className="inline-flex items-center rounded-md border border-primary-foreground px-3 py-2 text-sm font-medium hover:bg-white"
        >
          Email Support ({supportEmail})
        </a>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-md border border-primary-foreground px-3 py-2 text-sm font-medium hover:bg-white"
        >
          WhatsApp (+{whatsappNumber})
        </a>
      </div>
    </div>
  );
}
