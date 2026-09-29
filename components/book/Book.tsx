import { isPlaceholderPhoto, siteContent } from "@/lib/content";
import { revealIndex } from "@/lib/motion";
import { Reveal } from "@/components/Reveal";
import { BookRow } from "./BookRow";

// The book: the accessible, text-first list of everything on the coil,
// directly under the hero at #work (Menu, SiteNav, the case pages' back link
// and the /work redirect all land here). One desktop screen, two ordered
// columns, Work then Photos; one column under 720px. Adapted from WorkSection
// (kept for the ring home until slice 9) and its reveal pattern. A Server
// Component; only the rows are client leaves.
export function Book() {
  const { ariaLabel, workHeading, photosHeading, workRows, photoRows } = siteContent.book;
  const photos = photoRows.filter((row) => !isPlaceholderPhoto(row.src));

  return (
    <section
      id="work"
      aria-label={ariaLabel}
      className="relative flex min-h-screen w-full scroll-mt-24 items-center px-[6vw] py-[8vh]"
    >
      <div className="mx-auto grid w-full max-w-[1240px] grid-cols-1 items-start gap-y-14 min-[720px]:grid-cols-2 min-[720px]:gap-x-[5vw]">
        <div>
          <h2 className={HEADING_CLASS}>{workHeading}</h2>
          <Reveal as="ol" aria-label={workHeading} className="book-list">
            {workRows.map((row, i) => (
              <li key={row.key} className={ITEM_CLASS} style={revealIndex(i)}>
                <BookRow entry={{ kind: "work", row }} />
              </li>
            ))}
          </Reveal>
        </div>
        <div>
          <h2 className={HEADING_CLASS}>{photosHeading}</h2>
          <Reveal as="ol" aria-label={photosHeading} className="book-list">
            {photos.map((row, i) => (
              <li key={row.key} className={ITEM_CLASS} style={revealIndex(i)}>
                <BookRow entry={{ kind: "photo", row }} />
              </li>
            ))}
          </Reveal>
        </div>
      </div>
    </section>
  );
}

const HEADING_CLASS =
  "mb-[18px] font-serif text-[clamp(2.125rem,9vw,3rem)] leading-none tracking-[-0.02em] text-foreground min-[720px]:text-[clamp(2.125rem,3.2vw,3rem)]";

const ITEM_CLASS = "reveal-item border-t border-border last:border-b";
