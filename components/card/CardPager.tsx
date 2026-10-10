"use client";

import { useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import { siteContent } from "@/lib/content";
import { pageStage, stageHeight } from "@/lib/gallery/boxes";
import type { Gallery } from "@/lib/gallery/card";
import { GALLERY, PHONE_GROUPING } from "@/lib/gallery/constants";
import { pagerReducer } from "@/lib/gallery/pager";
import { stageKind, type Page } from "@/lib/gallery/plan";
import { useReducedMotionLive } from "@/components/soundtrack/useReducedMotionLive";
import { CardHeader } from "./CardHeader";
import { PagerControls } from "./PagerControls";
import { PagerPage } from "./PagerPage";
import { usePagerDrag } from "./usePagerDrag";

// The phone's gallery (under 1024px), the lab's round six pager: the header
// fixed above (a flown card parks on its tile, so no page carries it), one
// page a paragraph (PHONE_GROUPING), each page's photo or group whole in a
// stage at most 40 percent of the visible height with the words under it.
// The arrows and dots under the pages, the arrow keys anywhere in the dialog
// and a sideways drag change pages; a vertical flick on the stage, the header
// or words that fit closes the modal. Under reduced motion pages change with
// no travel.

type Props = { gallery: Gallery; pages: readonly Page[]; renderMedia: boolean; onClose: () => void };
type Room = { width: number; height: number; visible: number };

const g = siteContent.modals.gallery;

export function CardPager({ gallery, pages, renderMedia, onClose }: Props) {
  const count = pages.length;
  const reduced = useReducedMotionLive();
  const [state, dispatch] = useReducer(pagerReducer, { index: 0, count });
  const [room, setRoom] = useState<Room | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const { dragPx, pressing, handlers } = usePagerDrag(rootRef, { index: state.index, count, reduced, dispatch, onDismiss: onClose });
  const { pager } = GALLERY;
  // The stage's cap, or less when the page is too short to leave the words their room.
  const heightFor = (share: number, below: number) => stageHeight((room?.visible ?? 0) * share, (room?.height ?? 0) - below, pager.stageFloorPx);
  const layouts = pages.map((page) => {
    const kind = stageKind(page, PHONE_GROUPING);
    const photos = kind === "turns" ? page.photos : [page.photo];
    const height = page.wordless ? heightFor(pager.wordlessMax, pager.captionRoomPx) : heightFor(pager.stageMax, pager.wordsRoomPx);
    return { kind, stage: { photos, ...pageStage(photos, gallery.aspects, room?.width ?? 0, height) } };
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
  const live = PHONE_GROUPING === "photo" ? g.announce(state.index + 1, count, shown.captionShort ?? shown.caption ?? "") : g.pageNumber(state.index + 1, count);
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
            <PagerPage key={page.photo} gallery={gallery} page={page} index={i} count={count} kind={layouts[i].kind} stage={layouts[i].stage} current={i === state.index} pressing={pressing} />
          ))}
        </div>
      </div>
      {count > 1 && <PagerControls index={state.index} count={count} dispatch={dispatch} />}
      <p className="sr-only" aria-live="polite">
        {live}
      </p>
    </div>
  );
}
