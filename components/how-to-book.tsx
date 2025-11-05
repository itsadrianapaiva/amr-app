import { HOW_TO_BOOK } from "@/lib/content/how-to-book";
import HowToBookAutoplay from "@/components/how-to-book-autoplay.client";

/**
 * HowToBook
 * Server Component that embeds the Synthesia video player showing
 * how to book equipment with AMR.
 * Spacing normalized to MachineDetailPage pattern:
 * - Section: px-4/8/12 + py-16/24
 */
export default function HowToBook() {
  return (
    <section
      id="how-to-book"
      data-testid="how-to-book-section"
      className="px-4 py-16 md:py-24 md:px-8 lg:px-12"
    >
      <div className="container mx-auto">
        {/* Title block - centered */}
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
            {HOW_TO_BOOK.title}
          </h2>
          <p className="text-muted-foreground">{HOW_TO_BOOK.subtitle}</p>
        </div>

        {/* Video wrapper - responsive 16:9 with rounded frame */}
        <div className="mx-auto max-w-4xl">
          <div className="relative aspect-video overflow-hidden rounded-2xl shadow-lg">
            <HowToBookAutoplay videoEmbedSrc={HOW_TO_BOOK.videoEmbedSrc} />
            <noscript>
              <a
                href={HOW_TO_BOOK.videoEmbedSrc}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground"
              >
                Watch video: How to Book with Us
              </a>
            </noscript>
          </div>
        </div>

        {/* Transcript for accessibility */}
        {HOW_TO_BOOK.transcript && (
          <div className="mx-auto mt-8 max-w-4xl">
            <details className="rounded-lg border border-gray-200 p-4">
              <summary className="cursor-pointer font-medium text-sm">
                View Transcript
              </summary>
              <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">
                {HOW_TO_BOOK.transcript}
              </p>
            </details>
          </div>
        )}
      </div>
    </section>
  );
}
