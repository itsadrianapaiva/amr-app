"use client";

import Pretitle from "@/components/ui/pretitle";
import { Mail, MessageSquare, MapPin, Clock } from "lucide-react";
import type { ContactContent } from "@/lib/content/contacts";

/**
 * SupportPanel
 * Pure presentational block for WhatsApp/email/location/hours.
 * - No business logic (hrefs and address line are injected).
 * - Keeps this component easy to snapshot & unit test.
 */
type Props = {
  pretitle: string;
  title: string;
  subtitle: string;
  support: ContactContent["support"];
  location: ContactContent["location"];
  waHref: string;            // computed outside for testability
  addressLine: string;       // formatted single-line address
  mapsHref: string | null;   // prebuilt maps link or null to hide
};

export default function SupportPanel({
  pretitle,
  title,
  subtitle,
  support,
  location,
  waHref,
  addressLine,
  mapsHref,
}: Props) {
  return (
    <aside className="h-[640px] w-full xl:max-w-[380px] xl:border-r xl:border-border/40 xl:pr-[70px]">
      <Pretitle text={pretitle} />
      <h2 className="my-8 text-3xl font-bold tracking-tight md:text-4xl mb-2">{title}</h2>
      <p className="mb-8 text-muted-foreground">{subtitle}</p>

      <div className="mb-10 flex flex-col gap-6">
        {/* WhatsApp */}
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-surface p-2">
            <MessageSquare className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h3 className="text-lg font-semibold leading-none">WhatsApp support</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Fastest response during business hours.
            </p>
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-2 font-medium text-muted-background underline-offset-4 hover:underline"
            >
              {support.whatsapp.display}
            </a>
          </div>
        </div>

        {/* Email */}
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-surface p-2">
            <Mail className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h3 className="text-lg font-semibold leading-none">Email</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              We aim to reply within 1 business day.
            </p>
            <a
              href={`mailto:${support.email}`}
              className="mt-2 inline-flex items-center gap-2 font-medium text-muted-background underline-offset-4 hover:underline"
            >
              {support.email}
            </a>
          </div>
        </div>

        {/* Location */}
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-surface p-2">
            <MapPin className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h3 className="text-lg font-semibold leading-none">
              {location.label ?? "Location"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">{addressLine}</p>
            {mapsHref && (
              <a
                href={mapsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-2 font-medium text-muted-background underline-offset-4 hover:underline"
              >
                Open in Maps
              </a>
            )}
          </div>
        </div>

        {/* Hours (optional) */}
        {support.responseTimeNote && (
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-surface p-2">
              <Clock className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h3 className="text-lg font-semibold leading-none">Hours</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {support.responseTimeNote}
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
