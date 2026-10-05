import { siteContent } from "@/lib/content";
import { role } from "../Specimen";

// components/book/Book.tsx and BookRow.tsx: both column headings with a few
// rows each, the second work row in its seen state (dimmed title, ring).
const { workHeading, photosHeading, workRows, photoRows } = siteContent.book;
const WORK = workRows.filter((row) => ["capital-one-pm", "ieee-president", "aaronsulbaran-site"].includes(row.key));
const PHOTOS = photoRows.filter((row) => ["hsf-speaking", "yosemite-hiking"].includes(row.key));
const SEEN = "ieee-president";

const HEADING_CLASS =
  "mb-[18px] font-display text-[clamp(2.125rem,9vw,3rem)] leading-none tracking-[-0.02em] text-foreground min-[720px]:text-[clamp(2.125rem,3.2vw,3rem)]";
const ITEM_CLASS = "border-t border-border last:border-b";
const ROW_CLASS =
  "book-row grid min-h-[60px] w-full grid-cols-[minmax(0,1fr)] items-center gap-x-[14px] gap-y-1 py-[10px] text-left min-[720px]:min-h-[54px] min-[720px]:grid-cols-[minmax(0,1fr)_auto] rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const TITLE_CLASS =
  "min-w-0 font-display text-[clamp(1.125rem,1.5vw,1.375rem)] leading-[1.1] text-foreground transition-opacity duration-200 [.book-list:hover_.book-row:not(:hover)_&]:opacity-[0.55]";
const SEEN_TITLE_CLASS = "opacity-[0.55] [.book-row:focus-visible_&]:opacity-100 [.book-row:hover_&]:opacity-100";
const META_CLASS = "text-sm text-muted min-[720px]:whitespace-nowrap";
const SEEN_RING_CLASS = "ml-[10px] inline-block h-2 w-2 shrink-0 rounded-full border border-muted";

function Row({ title, meta, seen }: { title: string; meta: string; seen: boolean }) {
  return (
    <a href="#book" className={ROW_CLASS}>
      <span className="flex min-w-0 items-center">
        <span className={seen ? `${TITLE_CLASS} ${SEEN_TITLE_CLASS}` : TITLE_CLASS}>{title}</span>
        {seen && <span aria-hidden="true" className={SEEN_RING_CLASS} />}
      </span>
      <span className={META_CLASS} {...role("meta", 14)}>
        {meta}
      </span>
    </a>
  );
}

export function BookRows() {
  return (
    <div className="grid w-full grid-cols-1 items-start gap-y-14 min-[720px]:grid-cols-2 min-[720px]:gap-x-[5vw]">
      <div>
        <h2 className={HEADING_CLASS}>{workHeading}</h2>
        <ol className="book-list">
          {WORK.map((row) => (
            <li key={row.key} className={ITEM_CLASS}>
              <Row title={row.title} meta={row.meta} seen={row.key === SEEN} />
            </li>
          ))}
        </ol>
      </div>
      <div>
        <h2 className={HEADING_CLASS}>{photosHeading}</h2>
        <ol className="book-list">
          {PHOTOS.map((row) => (
            <li key={row.key} className={ITEM_CLASS}>
              <Row title={row.title} meta={row.meta} seen={false} />
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
