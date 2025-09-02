"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  /** Controlled submit state from the container */
  submitting: boolean;
  /** One-shot success feedback from the container */
  sent: boolean;
  /** Human friendly error string or null */
  error: string | null;
  /** Container-provided submit handler */
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;

  /** Content-driven text copy */
  title: string;
  description: string;
  privacyNote?: string;
  successNote?: string;

  /** Prefilled WhatsApp deep link for the secondary CTA */
  waHref: string;
};

/**
 * ContactForm
 * Pure presentational form. No business logic here.
 * Receives all strings, flags, and handlers via props.
 */
export default function ContactForm({
  submitting,
  sent,
  error,
  onSubmit,
  title,
  description,
  privacyNote,
  successNote,
  waHref,
}: Props) {
  return (
    <div className="flex-2 lg:mt-4">
      <h3 className="my-6 text-2xl font-bold tracking-tight md:text-3xl mb-2">
        {title}
      </h3>
      <p className="mb-9 text-muted-foreground">{description}</p>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {/* Name + Email */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <label htmlFor="name" className="text-sm font-medium">
              Name
            </label>
            <Input id="name" name="name" autoComplete="name" required />
          </div>

          <div className="grid gap-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </div>
        </div>

        {/* Message */}
        <div className="grid gap-2">
          <label htmlFor="message" className="text-sm font-medium">
            Message
          </label>
          <Textarea id="message" name="message" rows={5} required />
        </div>

        {/* Privacy note */}
        {privacyNote && (
          <p className="text-xs text-muted-foreground">{privacyNote}</p>
        )}

        {/* Feedback area */}
        <div aria-live="polite" className="min-h-6 text-sm">
          {error && <span className="text-red-600">{error}</span>}
          {sent && (
            <span className="text-green-700">
              {successNote ?? "Thanks, we will be in touch soon."}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Sending…" : "Send message"}
          </Button>

          {/* Secondary CTA: WhatsApp deep link */}
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-surface/20"
          >
            Message via WhatsApp
          </a>
        </div>
      </form>
    </div>
  );
}
