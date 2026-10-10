"use client";

import { useEffect, useImperativeHandle, useRef, useState, type RefObject, type Ref } from "react";
import { bookColumns, siteContent } from "@/lib/content";
import { useEscapeKey } from "@/lib/modal";
import { useSeen } from "@/lib/home/seen";
import { useHomeController } from "@/components/home/HomeController";
import { hintStore } from "@/lib/cursor/hover";
import type { CoilEntrance, CoilSceneApi } from "./CoilScene";
import { NameReadout } from "./NameReadout";
import { ShapeToggle } from "./ShapeToggle";
import type { CoilShape } from "@/lib/coil/shape";
import { Fill, FillArrow, FillSeed } from "@/components/fx/Fill";
import { FILL_PICK } from "@/lib/fx/fill";

// The hero's DOM layer over the canvas. The greeting and the name are both
// drawn in the canvas (fx-hero), so at rest this layer holds only the chevron
// nudge that points off the helix after a few seconds of captured wheeling,
// and the first-visit lines ("Keep exploring" once the first card has flown
// home, "Tap a card" once on a touch screen). The scene positions the nudge
// from its own rAF through the handle, so it never lags the canvas.
//
// The unwind egg's list lives here too: a lead (a slot the canvas name, and
// the greeting above it, move into) and one column of rows, each with an
// empty 3:4 box the scene lands that card in, its title and its meta. The
// scene measures the boxes and fades the layer per frame; while unwound the
// rows open their card's modal, and "Coil" or Esc winds the helix back (lab
// 1327-1360).
//
// It shows only while the scene draws (data-scene="on" on the hero); without
// a scene the hero still (or, while one is on its way or the still has not
// decoded, the h1) carries the greeting.

export type OverlayLayout = {
  controlPx: number; // the "Coil" control's size
};

export type OverlayNudge = { x: number; y: number; angle: number };

export type HeroOverlayHandle = {
  layout: (layout: OverlayLayout | null) => void;
  nudge: (nudge: OverlayNudge | null) => void;
  // Per scene frame: list progress 0 (coiled) to 1 (unwound), whether the
  // egg is on (it is on at progress 0 on the frame it starts), and whether the
  // strand is still latched (until the wind-back's last card is home).
  unwindFrame: (progress: number, on: boolean, latched: boolean) => void;
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
  // The controller's entrance: null while the loader holds the pane. The
  // touch line waits for it.
  entrance?: CoilEntrance | null;
  // The Coil and Band toggle: the shape in use and the visitor's pick.
  shape: CoilShape;
  onShapeChange: (shape: CoilShape) => void;
  // The scene draws (data-scene="on"): without one the toggle is out of reach.
  sceneOn: boolean;
};

// The nudge sits this far off the pointer, toward where the page scrolls.
const NUDGE_OFFSET_PX = 42;

// ---- fx-hero: the one-time lines ----
const KEEP_EXPLORING_KEY = "aaron-hint-keep";
const TAP_CARD_KEY = "aaron-hint-tap";
const LINE_IN_MS = 420;
const LINE_OUT_MS = 320;
const KEEP_HOLD_MS = 2500;
const TAP_HOLD_MS = 5000;
// ---- end fx-hero ----

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const seg = (x: number, a: number, b: number) => clamp01((x - a) / (b - a));
const smooth = (x: number) => x * x * (3 - 2 * x);
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

// The unwound list's rows: the strand's cards, grouped as the book groups them.
type ListRow = { key: string; title: string; meta: string };
const LIST_GROUPS: { heading: string; rows: readonly ListRow[] }[] = bookColumns.map((column) => ({ heading: column.heading, rows: column.rows }));
const LIST_ROW_COUNT = LIST_GROUPS.reduce((sum, group) => sum + group.rows.length, 0);

export function HeroOverlay({ ref, api, onRowOpen, entrance = null, shape, onShapeChange, sceneOn }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const nudgeRef = useRef<HTMLDivElement>(null);
  const nudgeOnRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  const nameSlotRef = useRef<HTMLSpanElement>(null);
  const coilControlRef = useRef<HTMLButtonElement>(null);
  const seatRef = useRef<HTMLDivElement>(null);
  const boxesRef = useRef(new Map<string, HTMLSpanElement>());
  const frameRef = useRef({ progress: -1, on: false });
  const [listOn, setListOn] = useState(false);
  // The seat stays the list's from the unwind's start until the latch lets go.
  const [seatHeld, setSeatHeld] = useState(false);
  const seatHeldRef = useRef(false);
  const seen = useSeen();

  useImperativeHandle(
    ref,
    () => ({
      layout(layout) {
        if (layout && coilControlRef.current) coilControlRef.current.style.fontSize = `${layout.controlPx.toFixed(1)}px`;
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
      unwindFrame(progress, on, latched) {
        const last = frameRef.current;
        if (on !== last.on) setListOn(on);
        const held = on || latched;
        if (held !== seatHeldRef.current) {
          seatHeldRef.current = held;
          setSeatHeld(held);
        }
        if (Math.abs(progress - last.progress) < 1e-4 && on === last.on) return;
        frameRef.current = { progress, on };
        // The list's text and the Coil control come in once the cards have
        // mostly landed (the canvas carries the name and the greeting).
        const list = listRef.current;
        if (list) {
          list.style.setProperty("--text-on", smooth(seg(progress, 0.62, 0.97)).toFixed(3));
          // Only the rows' text takes the pointer, once the cards have landed:
          // the cards themselves stay the canvas's (hover, click, double-click).
          list.dataset.live = on && progress > 0.9 ? "true" : "false";
        }
        const coil = coilControlRef.current;
        const shown = on ? smooth(seg(progress, 0.5, 1)) : 0;
        if (coil) {
          coil.style.opacity = shown.toFixed(3);
          coil.style.visibility = shown > 0.01 ? "visible" : "hidden";
        }
        // The toggle and the Coil control share one seat: one cross-fade on the unwind's clock.
        const seat = seatRef.current;
        if (seat) {
          seat.style.opacity = (1 - shown).toFixed(3);
          seat.style.visibility = shown > 0.99 ? "hidden" : "";
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

  const windBack = () => api?.current?.unwind(false);
  useEscapeKey(listOn, windBack);

  const { coilControl, name } = siteContent.hero;

  return (
    <div ref={rootRef} className="pointer-events-none invisible absolute inset-0 group-data-[scene=on]/hero:visible">
      <div
        ref={listRef}
        inert={!listOn}
        aria-hidden={!listOn}
        aria-label={siteContent.book.ariaLabel}
        role="region"
        className="group/list pointer-events-none absolute inset-0 grid grid-cols-[minmax(0,34fr)_minmax(0,66fr)] content-start items-start gap-x-[4vw] px-[6vw] pt-[var(--list-top,14vh)] data-[narrow=true]:grid-cols-1"
      >
        <div aria-hidden="true" className="group-data-[narrow=true]/list:mb-6">
          {/* The canvas greeting lands in this band, the canvas name in the slot below. */}
          <span className="mb-3 block h-4" />
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

      <ShapeToggle ref={seatRef} shape={shape} onShapeChange={onShapeChange} entrance={entrance} sceneOn={sceneOn} held={seatHeld} />
      <Fill
        ref={coilControlRef}
        {...FILL_PICK.hero}
        onClick={windBack}
        tabIndex={listOn ? 0 : -1}
        className={`${CONTROL_CLASS} absolute bottom-[24px] left-[28px]`}
        overClassName="flex items-center gap-2.5 pl-4 pr-1"
        style={{ opacity: 0, visibility: "hidden" }}
      >
        {coilControl}
        <FillSeed className="h-8 w-8">
          <FillArrow />
        </FillSeed>
      </Fill>

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

      <HintLine rootRef={rootRef} entrance={entrance} />
      <NameReadout />
    </div>
  );
}

// ---- fx-hero: the first-visit lines ----
// Once ever each, decorative (the cards stay reachable through the book).
// Fine pointer: when the first card ever opened has flown home, "Keep
// exploring" fades in at the hero's bottom center, holds, and goes (the
// cursor's "Open me" pill retires with that first open, in CustomCursor).
// Touch: "Tap a card" after the entrance, gone on the first tap or after 5s.
// Written imperatively, like the rest of this layer: a plain opacity fade,
// which is also the reduced-motion version.
function HintLine({ rootRef, entrance }: { rootRef: RefObject<HTMLDivElement | null>; entrance: CoilEntrance | null }) {
  const controller = useHomeController();
  const lineRef = useRef<HTMLParagraphElement>(null);
  const firstOpenRef = useRef(false);
  const hideRef = useRef<() => void>(() => {});
  const modalOpen = controller?.modalOpen ?? false;
  const flying = (controller?.flight ?? null) !== null;
  const input = controller?.drivers.input;
  const ready = controller?.phase === "ready" && entrance !== null;

  // Shows `text`, holds, fades out; hideRef dismisses it early.
  const show = (text: string, holdMs: number) => {
    const line = lineRef.current;
    if (!line) return;
    hideRef.current();
    line.textContent = text;
    line.style.transitionDuration = `${LINE_IN_MS}ms`;
    line.style.opacity = "0";
    let timer = 0;
    const hide = () => {
      window.clearTimeout(timer);
      line.style.transitionDuration = `${LINE_OUT_MS}ms`;
      line.style.opacity = "0";
      hideRef.current = () => {};
    };
    const frame = requestAnimationFrame(() => {
      line.style.opacity = "1";
    });
    timer = window.setTimeout(hide, LINE_IN_MS + holdMs);
    hideRef.current = () => {
      cancelAnimationFrame(frame);
      hide();
    };
  };

  // The first card ever opened: the cursor's pill retires for good.
  useEffect(() => {
    if (!modalOpen) return;
    hideRef.current();
    const store = hintStore();
    if (store.opened()) return;
    firstOpenRef.current = true;
    store.markOpened();
  }, [modalOpen]);

  // That card has flown home: one line, if the hero is still in view. The
  // controller drops its flight in the same task as the scene's handoff lands
  // the card (FlyingTile calls land(), then onClosingComplete), so this runs
  // on the landing itself, never on a timer; with no flight, at the close.
  useEffect(() => {
    if (modalOpen || flying || !firstOpenRef.current) return;
    firstOpenRef.current = false;
    if (input !== "fine") return;
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect || rect.bottom < window.innerHeight * 0.5 || rect.top > window.innerHeight * 0.5) return;
    if (hintStore().takeOnce(KEEP_EXPLORING_KEY)) show(siteContent.hero.hints.keepExploring, KEEP_HOLD_MS);
  });

  // Touch: once, after the entrance, until the first tap or 5s.
  useEffect(() => {
    if (!ready || input !== "coarse") return;
    const store = hintStore();
    if (store.opened() || !store.takeOnce(TAP_CARD_KEY)) return;
    show(siteContent.hero.hints.tapCard, TAP_HOLD_MS);
    const onTap = () => hideRef.current();
    window.addEventListener("pointerdown", onTap, { once: true });
    return () => window.removeEventListener("pointerdown", onTap);
  }, [ready, input]);

  return (
    <p
      ref={lineRef}
      data-hint-line
      aria-hidden="true"
      className="absolute bottom-[max(32px,7svh)] max-sm:bottom-[76px] left-1/2 -translate-x-1/2 whitespace-nowrap font-sans text-[14px] leading-none text-[color:var(--hero-greeting)] opacity-0 transition-opacity [transition-timing-function:var(--ease-out)]"
    />
  );
}

// ---- end fx-hero ----

const CONTROL_CLASS =
  "pointer-events-auto flex min-h-10 items-center gap-2.5 whitespace-nowrap rounded-full bg-[var(--menu-pill)] pl-4 pr-1 font-label leading-none text-accent backdrop-blur-[8px] [box-shadow:inset_0_0_0_1px_var(--color-border)] focus-visible:rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-accent";
