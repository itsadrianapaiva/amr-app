import { FAQ_CONTENT } from "@/lib/content/faq";
import Pretitle from "@/components/ui/pretitle";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

/**
 * Faq
 * Spacing & headings match MachineDetailPage:
 * - Section: px-4/8/12 + py-16/24
 * - Headings: explicit sizes (no .h2 utility)
 */
export default function Faq() {
  return (
    <section id="faq" className="px-4 py-16 md:py-24 md:px-8 lg:px-12">
      <div className="container mx-auto">
        {/* Intro */}
        <div className="mx-auto max-w-[560px] text-center">
          <Pretitle text={FAQ_CONTENT.pretitle} center />
          <h2 className="mb-3 text-2xl font-bold md:text-3xl">
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
              <AccordionTrigger className="px-4 py-4 text-left text-sm font-medium">
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
  );
}
