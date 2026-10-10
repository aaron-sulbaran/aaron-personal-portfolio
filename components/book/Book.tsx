import { bookColumns, siteContent } from "@/lib/content";
import { revealIndex } from "@/lib/motion";
import { Reveal } from "@/components/Reveal";
import { BookRow } from "./BookRow";

// The book: the accessible, text-first list of every card on the Coil, under the
// hero at #work. Two ordered columns, Work then People (one under 720px), with
// the Reveal pattern. A Server Component; only the rows are client leaves.
export function Book() {
  return (
    <section id="work" aria-label={siteContent.book.ariaLabel} className="relative flex min-h-screen w-full scroll-mt-24 items-center px-[6vw] py-[8vh]">
      <div className="mx-auto grid w-full max-w-[1240px] grid-cols-1 items-start gap-y-14 min-[720px]:grid-cols-2 min-[720px]:gap-x-[5vw]">
        {bookColumns.map((column) => (
          <div key={column.heading}>
            <h2 className={HEADING_CLASS}>{column.heading}</h2>
            <Reveal as="ol" aria-label={column.heading} className="book-list">
              {column.rows.map((row, i) => (
                <li key={row.key} className={ITEM_CLASS} style={revealIndex(i)}>
                  <BookRow row={row} />
                </li>
              ))}
            </Reveal>
          </div>
        ))}
      </div>
    </section>
  );
}

const HEADING_CLASS =
  "mb-[18px] font-display text-[clamp(2.125rem,9vw,3rem)] leading-none tracking-[-0.02em] text-foreground min-[720px]:text-[clamp(2.125rem,3.2vw,3rem)]";

const ITEM_CLASS = "reveal-item border-t border-border last:border-b";
