"use client";

import { useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import { siteContent } from "@/lib/content";
import { pageStage, stageHeight } from "@/lib/gallery/boxes";
import type { Gallery } from "@/lib/gallery/card";
import { GALLERY } from "@/lib/gallery/constants";
import { paginate, shapeKey, type Shape, type UnitMeasure } from "@/lib/gallery/paginate";
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
// The pager reads each page's stage and each block of its words as laid out
// and, before the first paint and again whenever the room changes, says which
// words do not fit beside their media (lib/gallery/paginate): those get pages
// of their own, in order, so no page scrolls its words inside it.

type Props = { gallery: Gallery; pages: readonly Page[]; renderMedia: boolean; onClose: () => void; shape: Shape; onShape: (shape: Shape) => void };
type Room = { width: number; height: number; visible: number };

const g = siteContent.modals.gallery;

export function CardPager({ gallery, pages, renderMedia, onClose, shape, onShape }: Props) {
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
  const layoutOf = (page: Page, wordless: boolean) => {
    const kind = stageKind(page, gallery.grouping);
    const photos = kind === "turns" ? page.photos : [page.photo];
    const height = wordless ? heightFor(pager.wordlessMax, pager.captionRoomPx) : heightFor(pager.stageMax, pager.wordsRoomPx);
    // A name tag and the post's card fill the column up to a comfortable width, each with a height of its own.
    const piece = gallery.photos[page.photo];
    const width = room?.width ?? 0;
    const own = piece.embed || piece.tag !== undefined ? { width: Math.min(width, pager.tagMaxPx), height } : null;
    return { kind, own: own !== null, stage: { photos, ...(own ? { frame: own, boxes: [own] } : pageStage(photos, gallery.aspects, width, height)) } };
  };
  const layouts = pages.map((page) => layoutOf(page, !!page.wordless));
  // The height a photo's or a group's stage has when words share its page (a name tag's and the post card's is their own, so not here).
  const together = new Map(pages.flatMap((page) => (page.wordsOnly ? [] : [[page.photo, layoutOf(page, false)] as const])).flatMap(([photo, layout]) => (layout.own ? [] : [[photo, layout.stage.frame.height] as const])));

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const read = () => setRoom({ width: viewport.clientWidth, height: viewport.clientHeight, visible: window.innerHeight });
    read();
    const observer = new ResizeObserver(read);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  // The words' shape, from the pages as laid out (offsetHeight: a transform never changes it). A block is as tall as it is on whichever page
  // it sits; a stage page's room above its words is read where it is and put back to the height the stage has with words beside it
  // (a photo's stage is taller when nothing shares its page), so the shape a page was laid out for and the one it measures to agree.
  const key = shapeKey(shape);
  useLayoutEffect(() => {
    const root = rootRef.current;
    const viewport = viewportRef.current;
    if (!room || !root || !viewport) return;
    const measure = () => {
      const units = new Map<number, { above?: number; blocks: { id: string; height: number }[] }>();
      root.querySelectorAll<HTMLElement>("[data-pager-page]").forEach((el) => {
        const photo = Number(el.dataset.unit);
        const unit = units.get(photo) ?? { blocks: [] };
        units.set(photo, unit);
        el.querySelectorAll<HTMLElement>("[data-block]").forEach((block) => unit.blocks.push({ id: block.dataset.block!, height: block.offsetHeight }));
        if (el.hasAttribute("data-words-only")) return;
        const text = el.querySelector("[data-pager-text]");
        const above = [...el.children].filter((child) => child !== text);
        let px = above.reduce((sum, child) => sum + (child as HTMLElement).offsetHeight, 0) + pager.pageGapPx * above.length;
        const stage = el.querySelector<HTMLElement>("[data-pager-stage]");
        const open = together.get(photo);
        if (stage && open !== undefined) px += open - stage.offsetHeight;
        unit.above = px;
      });
      const measured: UnitMeasure[] = [...units].flatMap(([photo, unit]) => (unit.above === undefined ? [] : [{ photo, above: unit.above, blocks: unit.blocks }]));
      const next = paginate(measured, viewport.clientHeight, { blockGap: pager.blockGapPx, endPad: pager.endPadPx });
      if (shapeKey(next) !== key) onShape(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    root.querySelectorAll("[data-pager-stage], [data-block]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // The measure reads the DOM; the room and the pages it was laid out for are what change it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.width, room?.height, key, onShape]);

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
