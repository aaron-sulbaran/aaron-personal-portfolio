"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { siteContent } from "@/lib/content";
import { useShown } from "../context";
import { role } from "../Specimen";

// components/book/Book.tsx and BookRow.tsx: both column headings with a few
// rows each, the second work row in its seen state (dimmed title, ring), and
// the longest meta on the site (Anthropic ambassador) to stress the width.
// metaWrap "fit" lets a row's meta drop under its title only when the two do
// not fit (a wrapping flex row, no breakpoint); a number does it for the
// whole column below that width (a container query on the site).
const { workHeading, photosHeading, workRows, photoRows } = siteContent.book;
const WORK = workRows.filter((row) => ["capital-one-pm", "ieee-president", "claude-ambassador", "aaronsulbaran-site"].includes(row.key));
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
const STACKED_ROW_CLASS = ROW_CLASS.replace(" min-[720px]:grid-cols-[minmax(0,1fr)_auto]", "");
const FIT_ROW_CLASS =
  "book-row flex min-h-[60px] w-full flex-wrap items-center justify-between gap-x-[14px] gap-y-1 py-[10px] text-left min-[720px]:min-h-[54px] rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const FIT_META_CLASS = "text-sm text-muted whitespace-nowrap";
const STACKED_META_CLASS = "text-sm text-muted";
const SEEN_RING_CLASS = "ml-[10px] inline-block h-2 w-2 shrink-0 rounded-full border border-muted";

function useNarrow(ref: RefObject<HTMLElement | null>, below: number | null): boolean {
  const [width, setWidth] = useState(Infinity);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return below !== null && width < below;
}

type Layout = "grid" | "stacked" | "fit";

function Row({ title, meta, seen, layout }: { title: string; meta: string; seen: boolean; layout: Layout }) {
  const rowClass = layout === "fit" ? FIT_ROW_CLASS : layout === "stacked" ? STACKED_ROW_CLASS : ROW_CLASS;
  const metaClass = layout === "fit" ? FIT_META_CLASS : layout === "stacked" ? STACKED_META_CLASS : META_CLASS;
  return (
    <a href="#book" className={rowClass} data-seen={seen ? "" : undefined}>
      <span className={layout === "fit" ? "flex max-w-full items-center" : "flex min-w-0 items-center"}>
        <span className={seen ? `${TITLE_CLASS} ${SEEN_TITLE_CLASS}` : TITLE_CLASS}>{title}</span>
        {seen && <span aria-hidden="true" className={SEEN_RING_CLASS} />}
      </span>
      <span className={metaClass} {...role("meta", 14, false, "besideTitle")}>
        {meta}
      </span>
    </a>
  );
}

export function BookRows() {
  const { metaWrap: wrap, copyOverrides: copy } = useShown();
  const below = typeof wrap === "number" ? wrap : null;
  const workRef = useRef<HTMLDivElement | null>(null);
  const photosRef = useRef<HTMLDivElement | null>(null);
  const layoutFor = (narrow: boolean): Layout => (wrap === "fit" ? "fit" : narrow ? "stacked" : "grid");
  const workLayout = layoutFor(useNarrow(workRef, below));
  const photosLayout = layoutFor(useNarrow(photosRef, below));
  return (
    <div className="grid w-full grid-cols-1 items-start gap-y-14 min-[720px]:grid-cols-2 min-[720px]:gap-x-[5vw]">
      <div ref={workRef}>
        <h2 className={HEADING_CLASS}>{workHeading}</h2>
        <ol className="book-list">
          {WORK.map((row) => (
            <li key={row.key} className={ITEM_CLASS}>
              <Row title={row.title} meta={copy[`book.workRows.${row.key}.meta`] ?? row.meta} seen={row.key === SEEN} layout={workLayout} />
            </li>
          ))}
        </ol>
      </div>
      <div ref={photosRef}>
        <h2 className={HEADING_CLASS}>{photosHeading}</h2>
        <ol className="book-list">
          {PHOTOS.map((row) => (
            <li key={row.key} className={ITEM_CLASS}>
              <Row title={row.title} meta={row.meta} seen={false} layout={photosLayout} />
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
