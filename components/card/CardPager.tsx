"use client";

import { useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import { siteContent } from "@/lib/content";
import { pageStage, stageHeight } from "@/lib/gallery/boxes";
import type { Gallery } from "@/lib/gallery/card";
import { GALLERY } from "@/lib/gallery/constants";
import { layoutKey, moreTrims, paginate, trimsKey, type BlockSize, type PageRules, type Shape, type Trims, type UnitMeasure } from "@/lib/gallery/paginate";
import { pagerReducer } from "@/lib/gallery/pager";
import { stageKind, type Page } from "@/lib/gallery/plan";
import { useReducedMotionLive } from "@/components/soundtrack/useReducedMotionLive";
import { CardHeader } from "./CardHeader";
import { PagerControls } from "./PagerControls";
import { PagerPage } from "./PagerPage";
import { usePagerDrag } from "./usePagerDrag";

// The phone's gallery (under 1024px), the lab's round six pager: the header
// fixed above (a flown card parks on its tile, so no page carries it), then
// the pages, each a photo (or a group taking turns, or the jobs card's name
// tag or post card) on a stage with its words under it. The arrows and dots
// under the pages, the arrow keys anywhere in the dialog and a sideways drag
// change pages; a vertical flick on the stage, the header or words that fit
// closes the modal. Under reduced motion pages change with no travel.
//
// The pager reads each block of words, each caption and each name tag's
// natural height as laid out and, before the first paint and again whenever
// the room changes, lays the pages out (lib/gallery/paginate): every page a
// photo and words, a stage no taller than 40 percent of the visible height and
// shorter where its words need the room, words that cannot fit beside even a
// short stage on further pages with a photo of their own, and on a page too
// short for a whole paragraph, the paragraph's phone omissions dropped one at
// a time (lib/content). Nothing scrolls inside a page.

export type PagerLayout = { shape: Shape; trims: Trims; room: string };
type Props = { gallery: Gallery; base: readonly Page[]; pages: readonly Page[]; renderMedia: boolean; onClose: () => void; layout: PagerLayout; onLayout: (next: PagerLayout) => void };
type Room = { width: number; height: number; visible: number };

const g = siteContent.modals.gallery;

export function CardPager({ gallery, base, pages, renderMedia, onClose, layout, onLayout }: Props) {
  const count = pages.length;
  const reduced = useReducedMotionLive();
  const [state, dispatch] = useReducer(pagerReducer, { index: 0, count });
  useLayoutEffect(() => dispatch({ type: "count", count }), [count]);
  const [room, setRoom] = useState<Room | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const { dragPx, pressing, handlers } = usePagerDrag(rootRef, { index: state.index, count, reduced, dispatch, onDismiss: onClose });
  const { pager } = GALLERY;
  const visible = room?.visible ?? 0;
  const cap = visible * pager.stageMax;
  const floor = Math.min(pager.stageFloorPx, cap);
  const isOwn = (photo: number) => !!gallery.photos[photo].embed || gallery.photos[photo].tag !== undefined;
  // A stage of wide photos keeps them most of the page's width on a stage shorter than the floor (IEEE's plaque photo beside two paragraphs).
  const floorOf = (photos: readonly number[]) => {
    const narrowest = Math.min(...photos.map((photo) => gallery.aspects[photo]));
    return Math.max(pager.stageMinPx, ((room?.width ?? 0) * pager.wideFloorShare) / narrowest);
  };
  // Before the pager has measured: the stage's cap, or less when the page is too short to leave the words their room.
  const firstStage = (page: Page) =>
    page.wordless ? stageHeight(visible * pager.wordlessMax, (room?.height ?? 0) - pager.captionRoomPx, floor) : stageHeight(cap, (room?.height ?? 0) - pager.wordsRoomPx, floor);
  const layoutOf = (page: Page) => {
    const kind = stageKind(page, gallery.grouping);
    const photos = kind === "turns" ? page.photos : [page.photo];
    const width = room?.width ?? 0;
    // A name tag and the post's card fill the column up to a comfortable width, each with a height of its own (shrunk to its room, FitStage).
    if (isOwn(page.photo)) {
      const own = { width: Math.min(width, pager.tagMaxPx), height: page.stage ?? room?.height ?? 0 };
      return { kind, stage: { photos, frame: own, boxes: [{ ...own, cropped: false }] } };
    }
    const height = page.stage ?? firstStage(page);
    return { kind, stage: { photos, ...pageStage(photos, gallery.aspects, width, height, pager.photoMinShare, (photo) => !!gallery.photos[photo].video, pager.photoMaxCrop) } };
  };
  const layouts = pages.map(layoutOf);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const read = () => setRoom({ width: viewport.clientWidth, height: viewport.clientHeight, visible: window.innerHeight });
    read();
    const observer = new ResizeObserver(read);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  // The pages' layout, from what they hold as laid out (offsetHeight: a transform never changes it). A block is as tall wherever it sits
  // (the words are the page's full width on every page), a caption is read from its own measure, and a name tag's natural height from
  // inside its stage, so the layout a page was drawn with measures to the same layout.
  const roomKey = room ? `${room.width}x${room.height}x${room.visible}` : "";
  const key = layoutKey(layout.shape);
  const trimmed = trimsKey(layout.trims);
  useLayoutEffect(() => {
    const root = rootRef.current;
    const viewport = viewportRef.current;
    if (!room || !root || !viewport) return;
    const measure = () => {
      // A new room starts again from every word: what a shorter one trimmed may fit now.
      if (layout.room !== roomKey && trimmed !== "") {
        onLayout({ shape: layout.shape, trims: {}, room: roomKey });
        return;
      }
      const captions = new Map<number, number>();
      root.querySelectorAll<HTMLElement>("[data-caption-measure]").forEach((el) => captions.set(Number(el.dataset.captionMeasure), el.offsetHeight));
      const units = new Map<number, { blocks: BlockSize[]; own?: number }>();
      root.querySelectorAll<HTMLElement>("[data-pager-page]").forEach((el) => {
        const unit = Number(el.dataset.unit);
        const entry = units.get(unit) ?? { blocks: [] };
        units.set(unit, entry);
        el.querySelectorAll<HTMLElement>("[data-block]").forEach((block) => entry.blocks.push({ id: block.dataset.block!, height: block.offsetHeight }));
        const natural = el.querySelector<HTMLElement>("[data-fit-inner]");
        if (natural) entry.own = natural.offsetHeight;
      });
      const measured = base.map((page, unit): UnitMeasure => {
        const entry = units.get(unit) ?? { blocks: [] };
        const photos = [...page.photos];
        const own = isOwn(page.photo) && entry.own !== undefined ? { own: entry.own } : { floor: floorOf(photos) };
        return { unit, photos, captions: photos.map((photo) => captions.get(photo) ?? 0), ...own, blocks: entry.blocks };
      });
      const rules: PageRules = { room: viewport.clientHeight, cap, wordlessCap: visible * pager.wordlessMax, floor, pageGap: pager.pageGapPx, blockGap: pager.blockGapPx, fitFloor: pager.fitFloor };
      const { shape, tooTall } = paginate(measured, rules);
      // A paragraph too tall for any page drops its next phone omission, and the pages are measured again with it shorter.
      const trims = moreTrims(layout.trims, tooTall, (unit) => siteContent.cards[gallery.key].modal.phoneOmit?.[gallery.words[unit]?.index ?? unit]?.length ?? 0);
      if (trims !== layout.trims) onLayout({ shape: layout.shape, trims, room: roomKey });
      else if (layoutKey(shape) !== key || layout.room !== roomKey) onLayout({ shape, trims, room: roomKey });
    };
    measure();
    const observer = new ResizeObserver(measure);
    root.querySelectorAll("[data-block], [data-fit-inner], [data-caption-measure]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // The measure reads the DOM; the room, the pages it was laid out for and the words' trims are what change it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomKey, key, trimmed, layout.room, onLayout]);

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
  const live = gallery.grouping === "photo" ? g.announce(state.index + 1, count, shown.captionShort ?? shown.caption ?? shown.alt) : g.pageNumber(state.index + 1, count);
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
            <PagerPage key={`${page.unit ?? i}-${page.part ?? 0}`} gallery={gallery} page={page} index={i} count={count} kind={layouts[i].kind} stage={layouts[i].stage} trims={layout.trims} current={i === state.index} pressing={pressing} />
          ))}
        </div>
        {/* Each caption at the pages' width, out of sight, so the layout knows its height on whichever page it lands (or none: a photo carried onto a later page has none). */}
        <div aria-hidden="true" inert className="pointer-events-none invisible absolute inset-x-0 top-0 flex flex-col" data-caption-measures="">
          {gallery.photos.map((photo, i) => {
            const text = photo.captionShort ?? photo.caption;
            return text ? (
              <p key={i} className="font-label text-label" data-caption-measure={i}>
                {text}
              </p>
            ) : null;
          })}
        </div>
      </div>
      {count > 1 && <PagerControls index={state.index} count={count} grouping={gallery.grouping} dispatch={dispatch} />}
      <p className="sr-only" aria-live="polite">
        {live}
      </p>
    </div>
  );
}
