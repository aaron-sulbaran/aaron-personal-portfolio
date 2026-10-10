"use client";

import type { FocusEvent, PointerEvent } from "react";
import { siteContent, type BookRowEntry } from "@/lib/content";
import { useIsSeen } from "@/lib/home/seen";
import { isKeyboardFocus } from "@/lib/input/modality";
import { useHomeController } from "@/components/home/HomeController";

// One row of the book: a button that opens its card's modal through the home
// controller (no flight; the controller marks it seen at close and returns focus
// here). A seen row keeps its ring, dims its title, and dims its meta to 0.75.
// Hovering a list dims every other row's title (never the meta), and a row under
// the mouse or keyboard focus glides its card to the front of the visible helix.
export function BookRow({ row }: { row: BookRowEntry }) {
  const controller = useHomeController();
  const focusProps = {
    onPointerEnter: (event: PointerEvent) => {
      if (event.pointerType === "mouse" || event.pointerType === "pen") controller?.focusCard(row.key, "pointer");
    },
    onPointerLeave: () => controller?.focusCard(null, "pointer"),
    onFocus: (event: FocusEvent<HTMLElement>) => {
      if (isKeyboardFocus(event.currentTarget)) controller?.focusCard(row.key, "focus");
    },
    onBlur: () => controller?.focusCard(null, "focus"),
  };
  const seen = useIsSeen(row.key);
  return (
    <button type="button" className={ROW_CLASS} data-card={row.key} aria-haspopup="dialog" {...focusProps} onClick={(event) => controller?.openCard(row.key, event.currentTarget)}>
      <span className="flex max-w-full items-center">
        <span className={seen ? `${TITLE_CLASS} ${SEEN_TITLE_CLASS}` : TITLE_CLASS}>{row.title}</span>
        {seen && <span aria-hidden="true" className={SEEN_RING_CLASS} />}
      </span>
      <span className={seen ? `${META_CLASS} ${SEEN_META_CLASS}` : META_CLASS}>{row.meta}</span>
      {seen && <span className="sr-only">, {siteContent.book.seenLabel}</span>}
    </button>
  );
}

// A wrapping flex row: the meta drops under its title only when the two do
// not fit side by side, and then starts at the row's left edge.
const ROW_BASE =
  "book-row flex min-h-[60px] w-full flex-wrap items-center justify-between gap-x-[14px] gap-y-1 py-[10px] text-left min-[720px]:min-h-[54px]";

const ROW_CLASS = `${ROW_BASE} rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`;

const TITLE_CLASS =
  "min-w-0 font-display text-[clamp(1.125rem,1.5vw,1.375rem)] leading-[1.1] text-foreground transition-opacity duration-200 [.book-list:hover_.book-row:not(:hover)_&]:opacity-[0.55]";

const META_CLASS = "max-w-full font-label text-label text-accent transition-opacity duration-200";

// ---- fx-chrome
// Seen rows (opened from the coil or the list, from lib/home/seen) keep their
// title at the dim a hovered list gives its other rows, for the whole visit,
// so what has been opened reads at a glance; the meta dims to 0.75 (0.55
// fails AA for small text). Hovering or keyboard focus brings both back to
// full ink. The ring is 1px of the muted token at 8px in both themes. The
// dimmed title measures about 4.3:1 on the light paper and 5.6:1 on the dark,
// above 3:1, so the dim stays an opacity rather than the muted color.
const SEEN_TITLE_CLASS =
  "opacity-[0.55] [.book-row:focus-visible_&]:opacity-100 [.book-row:hover_&]:opacity-100";

const SEEN_META_CLASS = "opacity-75 [.book-row:focus-visible_&]:opacity-100 [.book-row:hover_&]:opacity-100";

const SEEN_RING_CLASS = "ml-[10px] inline-block h-2 w-2 shrink-0 rounded-full border border-muted";
// ---- end fx-chrome
