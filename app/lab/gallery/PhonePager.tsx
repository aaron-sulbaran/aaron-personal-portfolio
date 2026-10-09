"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useLayoutEffect, useReducer, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { LAB_COPY, type LabCard } from "./cards";
import { PagerPage } from "./PagerPage";
import { pagerStage, repeatedBlocks, type Page } from "./plan";
import { Header } from "./parts";
import { autoAdvanceMs, axisOf, initialStage, pagerReducer, releaseOf, rubberBand, type Axis } from "./stage";
import { partId } from "./timing";

// Round four on a phone: a pager instead of a long scroll. The header stays
// fixed above; each page is one photo, its caption and its words, and they
// change together. The arrows and the dots stay in sync; a sideways swipe on
// the photo or the words turns one page; a vertical flick on the photo, the
// header or words that fit closes the modal (the X does too), a sideways
// swipe never does. A page whose words are long scrolls them in their own
// area and the photo never leaves view. Left and right arrow keys turn the
// page; under reduced motion pages change with no travel.

type Props = {
  card: LabCard;
  pages: Page[];
  aspects: number[];
  theme: "light" | "dark";
  innerWidth: number;
  capPx: number;
  slideMs: number;
  flickPx: number;
  ease: string;
  autoSeconds: number;
  startAfterMs: number;
  reduced: boolean;
  scale: number;
  onDismiss: () => void;
};

type Drag = { id: number; x: number; y: number; axis: Axis | null; lastX: number; lastY: number; lastT: number; velocity: number; scrolls: boolean };

// Room under the stage for the caption and two lines of words.
const WORDS_ROOM = 128;

export function PhonePager({ card, pages, aspects, theme, innerWidth, capPx, slideMs, flickPx, ease, autoSeconds, startAfterMs, reduced, scale, onDismiss }: Props) {
  const count = pages.length;
  const tickMs = autoAdvanceMs(autoSeconds, count, reduced);
  const [state, dispatch] = useReducer(pagerReducer, initialStage(count, tickMs !== null));
  const [dragPx, setDragPx] = useState<number | null>(null);
  // The pages' viewport as drawn: its width is the stage's (the panel's
  // border included), its height less the words' room caps the stage.
  const [room, setRoom] = useState<{ width: number; height: number } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<Drag | null>(null);
  const firstTick = useRef(true);
  const repeats = repeatedBlocks(pages);
  const stage = pagerStage(pages.map((p) => aspects[p.photo]), room ? Math.min(innerWidth, room.width) : innerWidth, capPx, room ? room.height - WORDS_ROOM : Infinity);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const read = () => setRoom({ width: viewport.clientWidth, height: viewport.clientHeight });
    read();
    const observer = new ResizeObserver(read);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (tickMs === null || !state.auto) return;
    const id = window.setTimeout(() => {
      firstTick.current = false;
      dispatch({ type: "tick" });
    }, firstTick.current ? startAfterMs + tickMs : tickMs);
    return () => window.clearTimeout(id);
  }, [state.index, state.auto, tickMs, startAfterMs]);

  // Arrow keys anywhere in the dialog, never while a lab control outside it
  // has focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const target = e.target as HTMLElement | null;
      const inDialog = !!rootRef.current?.closest("[data-gallery-dialog]")?.contains(target);
      if (!inDialog && target !== document.body) return;
      e.preventDefault();
      dispatch({ type: e.key === "ArrowRight" ? "next" : "prev" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const panel = () => rootRef.current?.closest<HTMLElement>("[data-gallery-panel]") ?? null;
  const movePanel = (dy: number, ms: number) => {
    const el = panel();
    if (!el) return;
    el.style.transition = ms ? `translate ${ms}ms cubic-bezier(0.22, 1, 0.36, 1)` : "none";
    el.style.translate = `0 ${dy}px`;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, a")) return;
    const text = target.closest<HTMLElement>("[data-pager-text]");
    const scrolls = !!text && text.scrollHeight > text.clientHeight + 1;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, axis: null, lastX: e.clientX, lastY: e.clientY, lastT: e.timeStamp, velocity: 0, scrolls };
    dispatch({ type: "touch" });
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    const dx = (e.clientX - d.x) / scale;
    const dy = (e.clientY - d.y) / scale;
    if (!d.axis) {
      d.axis = axisOf(dx, dy);
      if (d.axis === "y" && d.scrolls) {
        // The words scroll themselves; this drag is theirs.
        drag.current = null;
        return;
      }
      if (d.axis) rootRef.current?.setPointerCapture(e.pointerId);
    }
    const dt = e.timeStamp - d.lastT;
    if (dt > 0) d.velocity = (d.axis === "y" ? e.clientY - d.lastY : e.clientX - d.lastX) / scale / dt;
    d.lastX = e.clientX;
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
    if (d.axis === "x") setDragPx(rubberBand(dx, state.index, count));
    else if (d.axis === "y" && !reduced) movePanel(dy, 0);
  };

  const end = (e: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    setDragPx(null);
    const dy = (e.clientY - d.y) / scale;
    const release = cancelled ? "stay" : releaseOf(d.axis, (e.clientX - d.x) / scale, dy, d.velocity, { flickPx });
    if (release === "next" || release === "prev") dispatch({ type: release });
    else if (release === "dismiss") {
      if (!reduced) movePanel(Math.sign(dy) * (rootRef.current?.clientHeight ?? 600), 240);
      onDismiss();
    } else if (d.axis === "y") movePanel(0, reduced ? 0 : 260);
  };

  const travel = reduced || dragPx !== null ? 0 : slideMs;
  const current = pages[state.index];
  const caption = current ? (card.photos[current.photo].captionShort ?? card.photos[current.photo].caption ?? "") : "";

  return (
    <div
      ref={rootRef}
      role="group"
      aria-roledescription="carousel"
      aria-label={LAB_COPY.pagerLabel(count)}
      className="flex min-h-0 flex-1 select-none flex-col gap-4 [touch-action:none]"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => end(e, false)}
      onPointerCancel={(e) => end(e, true)}
      data-pager=""
      data-page={state.index}
    >
      <Header card={card} theme={theme} compact tight />
      <div ref={viewportRef} className="relative min-h-0 flex-1 overflow-hidden" data-pager-viewport="">
        <div
          className="flex h-full"
          style={{ transform: `translate3d(calc(${-state.index * 100}% + ${dragPx ?? 0}px), 0, 0)`, transition: `transform ${travel}ms ${ease}` }}
          data-pager-track=""
        >
          {pages.map((page, i) => (
            <PagerPage key={page.photo} card={card} page={page} index={i} count={count} box={stage.boxes[i]} current={i === state.index} innerWidth={innerWidth} aspect={aspects[page.photo]} repeated={repeats[i]} />
          ))}
        </div>
      </div>
      {count > 1 && (
        <div data-mask={partId.pager} data-mask-kind="text" data-mask-clip="" data-pager-controls="">
          <div data-mask-inner="" className="flex items-center justify-between gap-2">
            <Arrow label={LAB_COPY.previous} disabled={state.index === 0} onClick={() => dispatch({ type: "prev" })} next={false} />
            <div className="flex items-center justify-center">
              {pages.map((page, i) => (
                <button
                  key={`dot-${page.photo}`}
                  type="button"
                  aria-label={LAB_COPY.pageOf(i + 1, count)}
                  aria-current={i === state.index ? "true" : undefined}
                  onClick={() => dispatch({ type: "goto", index: i })}
                  className="group inline-flex h-8 w-7 items-center justify-center"
                  data-pager-dot={i}
                >
                  <span className={`block h-1.5 rounded-full transition-all duration-200 ${i === state.index ? "w-4 bg-accent" : "w-1.5 bg-border group-hover:bg-muted"}`} />
                </button>
              ))}
            </div>
            <Arrow label={LAB_COPY.next} disabled={state.index >= count - 1} onClick={() => dispatch({ type: "next" })} next />
          </div>
        </div>
      )}
      <p className="sr-only" aria-live={state.auto ? "off" : "polite"}>
        {LAB_COPY.announce(state.index + 1, count, caption)}
      </p>
    </div>
  );
}

function Arrow({ label, disabled, onClick, next }: { label: string; disabled: boolean; onClick: () => void; next: boolean }) {
  const Icon = next ? ChevronRight : ChevronLeft;
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-foreground transition-colors duration-200 hover:text-accent disabled:cursor-default disabled:opacity-35 disabled:hover:text-foreground"
      data-pager-arrow={next ? "next" : "prev"}
    >
      <Icon aria-hidden="true" className="h-4 w-4" />
    </button>
  );
}
