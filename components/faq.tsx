import { FAQ_CONTENT } from "@/lib/content/faq";
import Pretitle from "@/components/ui/pretitle";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import FAQPageJsonLd from "@/components/seo/faq-jsonld";

/**
 * Faq
 * Spacing & headings match MachineDetailPage:
 * - Section: px-4/8/12 + py-16/24
 * - Headings: explicit sizes (no .h2 utility)
 */
export default function Faq() {
  // Map your content to {question, answer} pairs for JSON-LD
  const faqItems = FAQ_CONTENT.items.map((it) => ({
    question: it.q,
    answer: it.a,
  }));

  return (
    <>
      {/* Inject FAQPage JSON-LD for rich results */}
      <FAQPageJsonLd items={faqItems} />
      <section id="faq" className="px-4 py-16 md:py-24 md:px-8 lg:px-12">
        <div className="container mx-auto">
          {/* Intro */}
          <div className="mx-auto max-w-[560px] text-center">
            <Pretitle text={FAQ_CONTENT.pretitle} center />
            <h2 className="my-6 text-3xl font-bold tracking-tight md:text-4xl">
              {FAQ_CONTENT.title}
            </h2>
            <p className="mx-auto mb-8 max-w-[520px] text-muted-foreground">
              {FAQ_CONTENT.subtitle}
            </p>
          </div>

          {/* Items */}
          <Accordion
            type="single"
            collapsible
            className="mx-auto w-full max-w-3xl divide-y divide-border rounded-lg border border-border bg-card"
          >
            {FAQ_CONTENT.items.map((item, idx) => (
              <AccordionItem key={item.q} value={`item-${idx}`}>
                <AccordionTrigger className="px-4 py-6 text-left text-sm font-medium">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 text-sm text-muted-foreground">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
    </>
  );
}
