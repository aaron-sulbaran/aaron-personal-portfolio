"use client";

import { useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import { siteContent } from "@/lib/content";
import { pageStage, stageHeight } from "@/lib/gallery/boxes";
import type { Gallery } from "@/lib/gallery/card";
import { GALLERY } from "@/lib/gallery/constants";
import { wordsToSplit, type UnitFit } from "@/lib/gallery/fit";
import { pagerReducer } from "@/lib/gallery/pager";
import { stageKind, type Page } from "@/lib/gallery/plan";
import { useReducedMotionLive } from "@/components/soundtrack/useReducedMotionLive";
import { CardHeader } from "./CardHeader";
import { PagerControls } from "./PagerControls";
import { PagerPage } from "./PagerPage";
import { usePagerDrag } from "./usePagerDrag";

// The phone's gallery (under 1024px), the lab's round six pager: the header
// fixed above (a flown card parks on its tile, so no page carries it), one
// page a paragraph (the gallery's grouping), each page's photo or group whole in a
// stage at most 40 percent of the visible height with the words under it.
// The arrows and dots under the pages, the arrow keys anywhere in the dialog
// and a sideways drag change pages; a vertical flick on the stage, the header
// or words that fit closes the modal. Under reduced motion pages change with
// no travel.
//
// A card that splits (onSplit given, lib/gallery/constants CARD_PHONE_SPLITS)
// reads each stage and each paragraph as laid out and gives a paragraph that
// does not fit under its stage a page of its own, before the first paint and
// again whenever the room changes; so no page scrolls its words inside it.

type Props = { gallery: Gallery; pages: readonly Page[]; renderMedia: boolean; onClose: () => void; split?: readonly number[]; onSplit?: (split: readonly number[]) => void };
type Room = { width: number; height: number; visible: number };

const g = siteContent.modals.gallery;

export function CardPager({ gallery, pages, renderMedia, onClose, split = [], onSplit }: Props) {
  const count = pages.length;
  const reduced = useReducedMotionLive();
  const [state, dispatch] = useReducer(pagerReducer, { index: 0, count });
  useLayoutEffect(() => dispatch({ type: "count", count }), [count]);
  const [room, setRoom] = useState<Room | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const { dragPx, pressing, handlers } = usePagerDrag(rootRef, { index: state.index, count, reduced, dispatch, onDismiss: onClose });
  const { pager } = GALLERY;
  // The stage's cap, or less when the page is too short to leave the words their room.
  const heightFor = (share: number, below: number) => stageHeight((room?.visible ?? 0) * share, (room?.height ?? 0) - below, pager.stageFloorPx);
  const layouts = pages.map((page) => {
    const kind = stageKind(page, gallery.grouping);
    const photos = kind === "turns" ? page.photos : [page.photo];
    const height = page.wordless ? heightFor(pager.wordlessMax, pager.captionRoomPx) : heightFor(pager.stageMax, pager.wordsRoomPx);
    // A name tag and the post's card fill the column up to a comfortable width, each with a height of its own.
    const piece = gallery.photos[page.photo];
    const width = room?.width ?? 0;
    const own = piece.embed || piece.tag !== undefined ? { width: Math.min(width, pager.tagMaxPx), height } : null;
    return { kind, stage: { photos, ...(own ? { frame: own, boxes: [own] } : pageStage(photos, gallery.aspects, width, height)) } };
  });

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const read = () => setRoom({ width: viewport.clientWidth, height: viewport.clientHeight, visible: window.innerHeight });
    read();
    const observer = new ResizeObserver(read);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  // Which paragraphs do not fit under their stage, read from the pages as laid out (offsetHeight: a transform never changes it): the
  // stage is as tall as it is wherever its words are, and the words' own height is their block's, so a split page and its parts agree.
  const splitKey = split.join(",");
  useLayoutEffect(() => {
    const root = rootRef.current;
    const viewport = viewportRef.current;
    if (!onSplit || !room || !root || !viewport) return;
    const measure = () => {
      const units = new Map<number, Partial<UnitFit>>();
      root.querySelectorAll<HTMLElement>("[data-pager-page]").forEach((el) => {
        const photo = Number(el.dataset.unit);
        const unit = units.get(photo) ?? { photo };
        const stage = el.querySelector<HTMLElement>("[data-pager-stage]");
        const words = el.querySelector<HTMLElement>("[data-pager-text] > div");
        if (stage) unit.stage = stage.offsetHeight;
        if (words) unit.words = words.offsetHeight;
        units.set(photo, unit);
      });
      const whole = [...units.values()].filter((unit): unit is UnitFit => unit.stage !== undefined && unit.words !== undefined);
      const next = wordsToSplit(whole, viewport.clientHeight, pager.pageGapPx);
      if (next.join(",") !== splitKey) onSplit(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    root.querySelectorAll("[data-pager-stage], [data-pager-text] > div").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // The measure reads the DOM; the room and the pages it was laid out for are what change it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.width, room?.height, splitKey, onSplit]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      if (e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const dialog = rootRef.current?.closest('[role="dialog"]');
      const target = e.target as Node | null;
      if (!dialog || !(target === document.body || (target !== null && dialog.contains(target)))) return;
      e.preventDefault();
      dispatch({ type: e.key === "ArrowRight" ? "next" : "prev" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const travel = reduced || dragPx !== null ? 0 : pager.slideMs;
  const shown = gallery.photos[pages[state.index].photo];
  const live = gallery.grouping === "photo" && !pages[state.index].wordsOnly ? g.announce(state.index + 1, count, shown.captionShort ?? shown.caption ?? shown.alt) : g.pageNumber(state.index + 1, count);
  // A pager with a page of words alone has pages that are not photos, so its dots are named by page.
  const dots = pages.some((page) => page.wordsOnly) ? "paragraph" : gallery.grouping;
  return (
    <div
      ref={rootRef}
      role="group"
      aria-roledescription={g.roleCarousel}
      aria-label={g.pagerLabel(count)}
      className="flex min-h-0 flex-1 select-none flex-col gap-4 [touch-action:none]"
      {...handlers}
      data-pager=""
      data-page={state.index}
    >
      <CardHeader cardKey={gallery.key} renderMedia={renderMedia} compact />
      <div ref={viewportRef} className="relative min-h-0 flex-1 overflow-hidden" data-pager-viewport="">
        <div
          className="flex h-full"
          style={{ transform: `translate3d(calc(${-state.index * 100}% + ${dragPx ?? 0}px), 0, 0)`, transition: `transform ${travel}ms ${GALLERY.ease.css}` }}
          data-pager-track=""
        >
          {pages.map((page, i) => (
            <PagerPage key={`${page.photo}${page.wordsOnly ? "-words" : ""}`} gallery={gallery} page={page} index={i} count={count} kind={layouts[i].kind} stage={layouts[i].stage} room={room?.height ?? 0} current={i === state.index} pressing={pressing} />
          ))}
        </div>
      </div>
      {count > 1 && <PagerControls index={state.index} count={count} grouping={dots} dispatch={dispatch} />}
      <p className="sr-only" aria-live="polite">
        {live}
      </p>
    </div>
  );
}
