"use client";

import { useMemo, useState } from "react";

import { CONTACTS } from "@/lib/content/contacts";
import {
  buildWhatsAppHref,
  formatAddress,
  getMapsLink,
  toFormPayload,
  validateContactPayload,
} from "@/lib/contacts/utils";
import SupportPanel from "@/components/contact/support-panel";
import ContactForm from "@/components/contact/contact-form";

export default function ContactSection() {
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pure, memoized derivations
  const waHref = useMemo(
    () => buildWhatsAppHref(CONTACTS.support.whatsapp),
    []
  );
  const addressLine = useMemo(() => formatAddress(CONTACTS.location), []);
  const mapsHref = useMemo(() => getMapsLink(CONTACTS.location), []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const payload = toFormPayload(new FormData(e.currentTarget));
      const errors = validateContactPayload(payload);
      if (errors.length > 0) {
        throw new Error(errors.join(" "));
      }

      // MVP: local-only success; replace with server action later.
      await new Promise((r) => setTimeout(r, 500));
      setSent(true);
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section id={CONTACTS.id} className="px-4 py-16 md:py-24 md:px-8 lg:px-12">
      <div className="container mx-auto">
        <div className="w-full border-t-4 border-primary p-4 shadow-custom xl:h-[730px] xl:p-8 xl:px-[90px] xl:py-[36px]">
          <div className="flex h-full flex-col gap-[40px] xl:flex-row xl:gap-[90px]">
            <SupportPanel
              pretitle={CONTACTS.pretitle}
              title={CONTACTS.title}
              subtitle={CONTACTS.subtitle}
              support={CONTACTS.support}
              location={CONTACTS.location}
              waHref={waHref}
              addressLine={addressLine}
              mapsHref={mapsHref}
            />
            <ContactForm
              submitting={submitting}
              sent={sent}
              error={error}
              onSubmit={onSubmit}
              title={CONTACTS.form.title}
              description={CONTACTS.form.description}
              privacyNote={CONTACTS.form.privacyNote}
              successNote={CONTACTS.form.successNote}
              waHref={waHref}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
