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

import {
  sendContactMessage,
  type ContactActionResult,
} from "@/app/actions/send-contact-message";

export default function ContactSection() {
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derive links and strings from content via pure helpers (testable, memoized)
  const waHref = useMemo(
    () => buildWhatsAppHref(CONTACTS.support.whatsapp),
    []
  );
  const addressLine = useMemo(() => formatAddress(CONTACTS.location), []);
  const mapsHref = useMemo(() => getMapsLink(CONTACTS.location), []);

  // Handle submit by delegating to shared validation + Server Action
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      // 1) Extract once and reuse for validation + server call
      const formEl = e.currentTarget;
      const fd = new FormData(formEl);

      // 2) Client-side validation for fast UX (server re-validates too)
      const payload = toFormPayload(fd);
      const errors = validateContactPayload(payload);
      if (errors.length > 0) {
        throw new Error(errors.join(" "));
      }

      // 3) Call the Server Action (typed, serializable result)
      const res: ContactActionResult = await sendContactMessage(fd);

      if (!res.ok) {
        setError(
          res.formError || "We couldn't send your message. Please try again."
        );
        return;
      }

      // 4) Success UX
      setSent(true);
      formEl.reset();
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
