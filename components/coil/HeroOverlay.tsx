"use client";

import { useEffect, useImperativeHandle, useRef, useState, type RefObject, type Ref } from "react";
import { siteContent, strandTiles } from "@/lib/content";
import { useEscapeKey } from "@/lib/modal";
import { useSeen } from "@/lib/home/seen";
import { scrollToTarget } from "@/lib/scroll";
import { COIL } from "@/lib/coil/constants";
import { LOADER } from "@/lib/loader/progress";
import type { CoilEntrance, CoilSceneApi } from "./CoilScene";

// The hero's DOM layer over the canvas: the greeting "Hi, I'm" above the
// canvas-drawn name, the "Work and photos" control on the greeting's line
// flush with the name's right edge (it scrolls to the book at #work), and the
// chevron nudge that points off the helix after a few seconds of captured
// wheeling. The scene positions all of it from its own rAF through the handle
// (layout on resize, the nudge per frame), so nothing lags the canvas; the
// layer sits in the hero beside the canvas and scrolls with it natively.
//
// The unwind egg's list lives here too: a lead (the greeting and a slot the
// canvas name moves into) and one column of rows, each with an empty 3:4 box
// the scene lands that card in, its title and its meta. The scene measures the
// boxes and fades the layer per frame; while unwound the rows open their
// card's modal, and "Coil" or Esc winds the helix back (lab 1327-1360).
//
// It shows only while the scene draws (data-scene="on" on the hero); without
// a scene the server-rendered h1 carries the greeting, so the greeting here
// is aria-hidden. After the loader, the greeting and its control fade in over
// 350ms on the site ease from the middle of the loader's exit; a fast start
// or an entrance at rest simply shows them.

export type OverlayLayout = {
  left: number; // the greeting's left edge, CSS px in the hero
  top: number; // the greeting line's top
  width: number; // to the name's right edge
  greetingPx: number;
  controlPx: number;
};

export type OverlayNudge = { x: number; y: number; angle: number };

export type HeroOverlayHandle = {
  layout: (layout: OverlayLayout | null) => void;
  nudge: (nudge: OverlayNudge | null) => void;
  // Per scene frame: list progress 0 (coiled) to 1 (unwound), and whether the
  // egg is on (it is on at progress 0 on the frame it starts).
  unwindFrame: (progress: number, on: boolean) => void;
  // Each row's card box in viewport px, by tile key.
  listTargets: () => ReadonlyMap<string, DOMRect>;
  // The lead's name slot in viewport px, and its font size.
  nameSlot: () => { rect: DOMRect; fontPx: number } | null;
};

type Props = {
  ref?: Ref<HeroOverlayHandle>;
  api?: RefObject<CoilSceneApi | null>;
  // A row of the unwound list opens its card's modal (with the flight).
  onRowOpen?: (key: string, origin: HTMLElement) => void;
  // The controller's entrance (slice 4): null while the loader holds the pane.
  entrance?: CoilEntrance | null;
};

const GREETING_FADE_MS = 350;

// When the greeting starts to fade in, on the performance.now() clock: the
// middle of the loader's continuity exit (the entrance starts entranceOverlapMs
// before that exit ends), or the entrance itself when no exit ran.
function greetingStartMs(entrance: CoilEntrance) {
  if (!entrance.nameFromLoader) return entrance.startMs;
  return entrance.startMs - (LOADER.exitMs - LOADER.entranceOverlapMs) + LOADER.exitMs / 2;
}

// The nudge sits this far off the pointer, toward where the page scrolls.
const NUDGE_OFFSET_PX = 42;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const seg = (x: number, a: number, b: number) => clamp01((x - a) / (b - a));
const smooth = (x: number) => x * x * (3 - 2 * x);
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

// The unwound list's rows: the strand's cards, grouped as the book groups them.
type ListRow = { key: string; title: string; meta: string };
const strandKeys = new Set<string>(strandTiles.map((tile) => tile.key));
const LIST_GROUPS: { heading: string; rows: ListRow[] }[] = [
  { heading: siteContent.book.workHeading, rows: siteContent.book.workRows.filter((row) => strandKeys.has(row.key)) },
  { heading: siteContent.book.photosHeading, rows: siteContent.book.photoRows.filter((row) => strandKeys.has(row.key)) },
];
const LIST_ROW_COUNT = LIST_GROUPS.reduce((sum, group) => sum + group.rows.length, 0);

export function HeroOverlay({ ref, api, onRowOpen, entrance = null }: Props) {
  const introRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const greetingRef = useRef<HTMLSpanElement>(null);
  const controlRef = useRef<HTMLButtonElement>(null);
  const nudgeRef = useRef<HTMLDivElement>(null);
  const nudgeOnRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  const nameSlotRef = useRef<HTMLSpanElement>(null);
  const coilControlRef = useRef<HTMLButtonElement>(null);
  const boxesRef = useRef(new Map<string, HTMLSpanElement>());
  const frameRef = useRef({ progress: -1, on: false });
  const [listOn, setListOn] = useState(false);
  const seen = useSeen();

  useImperativeHandle(
    ref,
    () => ({
      layout(layout) {
        const row = rowRef.current;
        if (!row) return;
        if (!layout) {
          row.style.visibility = "hidden";
          return;
        }
        row.style.visibility = "";
        row.style.transform = `translate3d(${layout.left.toFixed(1)}px, ${layout.top.toFixed(1)}px, 0)`;
        row.style.width = `${layout.width.toFixed(1)}px`;
        if (greetingRef.current) greetingRef.current.style.fontSize = `${layout.greetingPx.toFixed(1)}px`;
        if (controlRef.current) controlRef.current.style.fontSize = `${layout.controlPx.toFixed(1)}px`;
        if (coilControlRef.current) coilControlRef.current.style.fontSize = `${layout.controlPx.toFixed(1)}px`;
      },
      nudge(nudge) {
        const el = nudgeRef.current;
        if (!el) return;
        const on = nudge !== null;
        if (on !== nudgeOnRef.current) {
          nudgeOnRef.current = on;
          // fx-input: it fades in, and goes the instant the coil lets go of
          // the wheel (no fade out while the page already scrolls).
          el.style.transitionDuration = on ? "" : "0ms";
          el.style.opacity = on ? "0.7" : "0";
        }
        if (!nudge) return;
        const x = nudge.x + Math.cos(nudge.angle) * NUDGE_OFFSET_PX;
        const y = nudge.y + Math.sin(nudge.angle) * NUDGE_OFFSET_PX;
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${nudge.angle.toFixed(3)}rad)`;
      },
      unwindFrame(progress, on) {
        const last = frameRef.current;
        if (on !== last.on) setListOn(on);
        if (Math.abs(progress - last.progress) < 1e-4 && on === last.on) return;
        frameRef.current = { progress, on };
        // The greeting and its control step aside; the list's text and the
        // Coil control come in once the cards have mostly landed.
        const away = 1 - smooth(seg(progress, 0, 0.3));
        if (rowRef.current) rowRef.current.style.opacity = away.toFixed(3);
        const list = listRef.current;
        if (list) {
          list.style.setProperty("--text-on", smooth(seg(progress, 0.62, 0.97)).toFixed(3));
          // Only the rows' text takes the pointer, once the cards have landed:
          // the cards themselves stay the canvas's (hover, click, double-click).
          list.dataset.live = on && progress > 0.9 ? "true" : "false";
        }
        const coil = coilControlRef.current;
        if (coil) {
          const shown = on ? smooth(seg(progress, 0.5, 1)) : 0;
          coil.style.opacity = shown.toFixed(3);
          coil.style.visibility = shown > 0.01 ? "visible" : "hidden";
        }
      },
      listTargets() {
        const out = new Map<string, DOMRect>();
        boxesRef.current.forEach((box, key) => out.set(key, box.getBoundingClientRect()));
        return out;
      },
      nameSlot() {
        const slot = nameSlotRef.current;
        if (!slot) return null;
        return { rect: slot.getBoundingClientRect(), fontPx: parseFloat(getComputedStyle(slot).fontSize) || 0 };
      },
    }),
    [],
  );

  // The list's rhythm from the hero's own size (lab sizeList 950-969): rows
  // share the height under the lead, cards 0.84 of a row at 3:4.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const size = () => {
      const W = list.clientWidth;
      const H = list.clientHeight;
      if (!W || !H) return;
      const narrow = W / H < 0.8;
      const top = Math.max(84, H * 0.15);
      const nameFont = narrow ? clamp(W * 0.14, 48, 96) : clamp(W * 0.084, 64, 128);
      const lead = narrow ? nameFont * 1.35 + 40 : 0;
      const heads = LIST_GROUPS.length * 34;
      const row = clamp((H - top - lead - heads - 56) / LIST_ROW_COUNT, 26, 62);
      const thumbH = Math.round(row * 0.84);
      list.style.setProperty("--list-top", `${top.toFixed(0)}px`);
      list.style.setProperty("--row", `${row.toFixed(1)}px`);
      list.style.setProperty("--thumb-h", `${thumbH}px`);
      list.style.setProperty("--thumb-w", `${Math.round(thumbH * 0.75)}px`);
      list.style.setProperty("--title", `${clamp(row * 0.46, 15, 26).toFixed(1)}px`);
      list.style.setProperty("--name", `${nameFont.toFixed(1)}px`);
      list.dataset.narrow = narrow ? "true" : "false";
    };
    size();
    const observer = new ResizeObserver(size);
    observer.observe(list);
    return () => observer.disconnect();
  }, []);

  // The greeting's entrance fade, written imperatively (it runs on the
  // performance.now() clock the loader hands over).
  useEffect(() => {
    const intro = introRef.current;
    if (!intro || !entrance) return;
    if (!Number.isFinite(entrance.startMs)) {
      intro.style.transition = "none";
      intro.style.opacity = "1";
      return;
    }
    const delay = Math.max(0, greetingStartMs(entrance) - performance.now());
    intro.style.transition = `opacity ${GREETING_FADE_MS}ms cubic-bezier(${COIL.siteEase.join(",")}) ${delay.toFixed(0)}ms`;
    intro.style.opacity = "1";
  }, [entrance]);

  const windBack = () => api?.current?.unwind(false);
  useEscapeKey(listOn, windBack);

  const { greeting, listControl, coilControl, name } = siteContent.hero;

  const goToBook = () => {
    scrollToTarget("#work", window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  };

  return (
    <div className="pointer-events-none invisible absolute inset-0 group-data-[scene=on]/hero:visible">
      <div ref={introRef} className="absolute inset-0" style={{ opacity: 0 }}>
        <div
          ref={rowRef}
          inert={listOn}
          className="absolute left-0 top-0 flex items-baseline justify-between font-sans leading-none text-[color:var(--hero-greeting)]"
          style={{ visibility: "hidden" }}
        >
          <span ref={greetingRef} aria-hidden="true" className="whitespace-nowrap font-medium">
            {greeting}
          </span>
          <button ref={controlRef} type="button" onClick={goToBook} className={`${CONTROL_CLASS} -my-[14px] -mr-2`}>
            {listControl}
          </button>
        </div>
      </div>

      <div
        ref={listRef}
        inert={!listOn}
        aria-hidden={!listOn}
        aria-label={siteContent.book.ariaLabel}
        role="region"
        className="group/list pointer-events-none absolute inset-0 grid grid-cols-[minmax(0,34fr)_minmax(0,66fr)] content-start items-start gap-x-[4vw] px-[6vw] pt-[var(--list-top,14vh)] data-[narrow=true]:grid-cols-1"
      >
        <div aria-hidden="true" className="text-[color:var(--hero-greeting)] group-data-[narrow=true]/list:mb-6">
          <p className="mb-3 text-base font-medium leading-none opacity-[var(--text-on,0)]">{greeting}</p>
          {/* The canvas name lands here; this text only holds the slot. */}
          <span
            ref={nameSlotRef}
            className="block whitespace-nowrap font-display text-[length:var(--name,96px)] leading-none tracking-[-0.02em] text-transparent"
          >
            {name}
          </span>
        </div>
        <div>
          {LIST_GROUPS.map((group) => (
            <div key={group.heading}>
              <p className="mb-[10px] mt-[14px] text-[13px] leading-none text-[color:var(--hero-greeting)] opacity-[var(--text-on,0)]">
                {group.heading}
              </p>
              <ol>
                {group.rows.map((row) => (
                  <li key={row.key} className="flex h-[var(--row,44px)] items-center gap-4">
                    <span
                      ref={(el) => {
                        if (el) boxesRef.current.set(row.key, el);
                        else boxesRef.current.delete(row.key);
                      }}
                      aria-hidden="true"
                      className="block h-[var(--thumb-h,36px)] w-[var(--thumb-w,27px)] shrink-0"
                    />
                    <button
                      type="button"
                      onClick={(event) => onRowOpen?.(row.key, event.currentTarget)}
                      className="flex h-full min-w-0 items-center rounded-sm text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent group-data-[live=true]/list:pointer-events-auto"
                    >
                      <span className="flex min-w-0 items-baseline gap-3 opacity-[var(--text-on,0)]">
                        <span className="whitespace-nowrap font-display text-[length:var(--title,20px)] leading-none text-foreground">
                          {row.title}
                        </span>
                        {seen.has(row.key) && (
                          <span
                            aria-hidden="true"
                            className="inline-block h-2 w-2 shrink-0 self-center rounded-full border border-current text-foreground"
                          />
                        )}
                        <span className="truncate text-[13px] text-[color:var(--hero-greeting)]">{row.meta}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>

      <button
        ref={coilControlRef}
        type="button"
        onClick={windBack}
        tabIndex={listOn ? 0 : -1}
        className={`${CONTROL_CLASS} absolute bottom-[24px] left-[28px] font-sans text-[color:var(--hero-greeting)]`}
        style={{ opacity: 0, visibility: "hidden" }}
      >
        {coilControl}
      </button>

      <div
        ref={nudgeRef}
        aria-hidden="true"
        className="absolute left-0 top-0 -ml-[13px] -mt-[13px] h-[26px] w-[26px] text-foreground opacity-0 transition-opacity duration-[600ms] [transition-timing-function:var(--ease-out)]"
      >
        <svg viewBox="0 0 26 26" className="block h-full w-full">
          <circle cx="13" cy="13" r="12" fill="none" stroke="currentColor" strokeWidth="1" />
          <path
            d="M11 8.5l4.5 4.5-4.5 4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}

const CONTROL_CLASS =
  "pointer-events-auto whitespace-nowrap rounded px-2 py-[14px] leading-none transition-colors duration-200 [transition-timing-function:var(--ease-out)] hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-accent";
