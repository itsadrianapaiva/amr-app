import Image from "next/image";
import { Lock, FileText, BadgeCheck, Star } from "lucide-react";
import { TRUST_SECTION } from "@/lib/content/trust-section";
import { TRUST_PARTNERS } from "@/lib/content/trust-partners";
import { PAYMENT_METHOD_LOGOS } from "@/lib/content/payment-methods";

/**
 * Map icon names to Lucide components.
 */
const ICON_MAP = {
  lock: Lock,
  document: FileText,
  "badge-check": BadgeCheck,
  star: Star,
} as const;

/**
 * TrustLogosSection
 * Displays trust partners, compliance messaging, and payment method logos.
 * Rendered on homepage between catalog and "Why Book" sections.
 */
export default function TrustLogosSection() {
  const homepagePartners = TRUST_PARTNERS.filter((p) => p.showOnHomepage);

  return (
    <section className="px-8 py-16 md:py-24 md:px-8 lg:px-12">
      <div className="container mx-auto">
        {/* Header */}
        <div className="mb-12 text-center">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
            {TRUST_SECTION.title}
          </h2>
          <p className="mt-3 mx-auto max-w-xl text-sm md:text-base text-muted-foreground">
            {TRUST_SECTION.subtitle}
          </p>
        </div>

        {/* Trust partners grid */}
        <div className="mb-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {homepagePartners.map((partner) => {
            const IconComponent =
              ICON_MAP[partner.iconName as keyof typeof ICON_MAP];
            return (
              <div
                key={partner.id}
                className="flex items-start gap-3 rounded-lg border border-border bg-background p-4"
              >
                {IconComponent && (
                  <IconComponent className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
                )}
                <div>
                  <p className="font-medium text-sm">{partner.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {partner.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Payment methods strip */}
        <div className="flex flex-col items-center gap-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Payment methods
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6">
            {PAYMENT_METHOD_LOGOS.map((logo) => (
              <Image
                key={logo.id}
                src={logo.imageSrc}
                alt={logo.alt}
                width={80}
                height={24}
                className="h-6 w-auto"
                sizes="(min-width: 768px) 120px, 80px"
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
