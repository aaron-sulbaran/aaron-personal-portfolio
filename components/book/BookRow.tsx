"use client";

import Link from "next/link";
import type { FocusEvent, PointerEvent } from "react";
import { photoBySrc, siteContent, bookWorkTarget, type BookPhotoRow, type BookWorkRow } from "@/lib/content";
import { useIsSeen } from "@/lib/home/seen";
import { useHomeController } from "@/components/home/HomeController";

export type BookEntry = { kind: "work"; row: BookWorkRow } | { kind: "photo"; row: BookPhotoRow };

// One row of the book. Work rows are links (a case study, or a live site in a
// new tab) and count as seen on click; "soon" rows are plain text until they
// have somewhere to go. Photo rows are buttons that open the photo modal
// through the home controller, which marks them seen at close and returns
// focus here. The seen ring sits inline after the title and never greys the
// row. Hovering a list dims every other row's title (never the meta), and a
// row under the mouse or keyboard focus glides its card to the front of the
// visible helix (the hover-jump; the scene ignores it when the hero is off
// screen, unwound, or absent).
export function BookRow({ entry }: { entry: BookEntry }) {
  const controller = useHomeController();
  const { key: rowKey } = entry.row;
  // fx-input: the row hover signal. Keyboard focus only (a mouse click that
  // focuses the row is not a keyboard focus).
  const focusProps = {
    onPointerEnter: (event: PointerEvent) => {
      if (event.pointerType === "mouse" || event.pointerType === "pen") controller?.focusCard(rowKey, "pointer");
    },
    onPointerLeave: () => controller?.focusCard(null, "pointer"),
    onFocus: (event: FocusEvent<HTMLElement>) => {
      if (event.currentTarget.matches(":focus-visible")) controller?.focusCard(rowKey, "focus");
    },
    onBlur: () => controller?.focusCard(null, "focus"),
  };
  const seen = useIsSeen(entry.row.key);
  const { seenLabel, externalLabel } = siteContent.book;
  const content = (
    <>
      <span className="flex min-w-0 items-center">
        <span className={TITLE_CLASS}>{entry.row.title}</span>
        {seen && (
          <span aria-hidden="true" className="ml-[10px] inline-block h-2 w-2 shrink-0 rounded-full border border-current text-foreground" />
        )}
      </span>
      <span className={META_CLASS}>{entry.row.meta}</span>
      {seen && <span className="sr-only">, {seenLabel}</span>}
    </>
  );

  if (entry.kind === "photo") {
    const photo = photoBySrc.get(entry.row.src);
    const { key } = entry.row;
    return (
      <button
        type="button"
        className={ROW_CLASS}
        {...focusProps}
        onClick={(event) => {
          if (photo) controller?.openPhoto(photo, key, event.currentTarget);
        }}
      >
        {content}
      </button>
    );
  }

  const { row } = entry;
  const target = bookWorkTarget(row);
  if (target.kind === "case") {
    return (
      <Link
        href={`/work/${target.slug}`}
        className={ROW_CLASS}
        {...focusProps}
        onClick={() => controller?.markVisited(row.key)}
      >
        {content}
      </Link>
    );
  }
  if (target.kind === "external") {
    return (
      <a
        href={target.href}
        target="_blank"
        rel="noopener noreferrer"
        className={ROW_CLASS}
        {...focusProps}
        onClick={() => controller?.markVisited(row.key)}
      >
        {content}
        <span className="sr-only">, {externalLabel}</span>
      </a>
    );
  }
  return <div className={`${ROW_BASE} cursor-default`}>{content}</div>;
}

const ROW_BASE =
  "book-row grid min-h-[60px] w-full grid-cols-[minmax(0,1fr)] items-center gap-x-[14px] gap-y-1 py-[10px] text-left min-[720px]:min-h-[54px] min-[720px]:grid-cols-[minmax(0,1fr)_auto]";

const ROW_CLASS = `${ROW_BASE} rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`;

const TITLE_CLASS =
  "min-w-0 font-display text-[clamp(1.125rem,1.5vw,1.375rem)] leading-[1.1] text-foreground transition-opacity duration-200 [.book-list:hover_.book-row:not(:hover)_&]:opacity-[0.55]";

const META_CLASS = "text-sm text-muted min-[720px]:whitespace-nowrap";
