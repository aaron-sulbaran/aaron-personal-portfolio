"use client";

import { useEffect, useId, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "framer-motion";
import { AsMark } from "@/components/menu/BrandMark";
import { MARK_HOLD_IDLE, setMarkHold } from "@/lib/cursor/hover";
import { loadCard } from "@/lib/mark/cardChunk";
import { MARK } from "@/lib/mark/constants";
import { BAR_D, BOLT_D, FILL_BOTTOM, FILL_TOP, LEG_D, VIEW_BOX } from "@/lib/mark/geometry";
import { HOLD_IDLE, advance, cancel, click, press, release, sample, settle, type HoldSource } from "@/lib/mark/hold";
import { closeMenu, getMenuOpen } from "@/lib/menu";

// The top-left mark. A click scrolls to the top as it always has. A press
// fills it two-tone from the bottom like the loader's name; a 650ms hold
// discharges and opens the card, and the click that ends it is swallowed.
// One clock (lib/mark/hold) paints the mark here and publishes the same fill
// for the cursor's ring. Keyboard: Enter or Space held; Escape cancels.
// Touch: no pan, no callout, no context menu on the mark. The card never
// opens over the Menu: a hold that fires with the Menu open closes it first.
const HOLD_KEYS = new Set(["Enter", " "]);

// The card carries GSAP and the cel strike, so it is its own chunk: the first
// pointerenter, focus or press arms it and starts the load, well before a hold
// can fire (lib/mark/cardChunk). Armed, it stays mounted so the exit plays.
const MarkCard = dynamic(() => loadCard().then((m) => m.MarkCard), { ssr: false });

// After a keyboard hold opens the card, focus lands on Close while the key
// may still be down; its repeats and its release must not press Close. A
// window blur ends it too, since that keyup may never arrive here.
function swallowHeldKey(key: string) {
  function swallow(event: KeyboardEvent) {
    if (event.key !== key) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.type === "keyup") done();
  }
  function done() {
    window.removeEventListener("keydown", swallow, true);
    window.removeEventListener("keyup", swallow, true);
    window.removeEventListener("blur", done);
  }
  window.addEventListener("keydown", swallow, true);
  window.addEventListener("keyup", swallow, true);
  window.addEventListener("blur", done);
}

type Props = { ariaLabel: string; className: string; onActivate: () => void };

export function MarkTrigger({ ariaLabel, className, onActivate }: Props) {
  const clipId = `${useId().replace(/:/g, "")}-rise`;
  const reduced = !!useReducedMotion();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const riseRef = useRef<SVGRectElement>(null);
  const hold = useRef(HOLD_IDLE);
  const heldKey = useRef<string | null>(null);
  const openRef = useRef(false);
  const kick = useRef<() => void>(() => {});
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const now = performance.now();
      let state = advance(hold.current, now);
      if (state.phase === "fired") {
        state = settle(state);
        if (getMenuOpen()) closeMenu();
        openRef.current = true;
        setArmed(true);
        setOpen(true);
        if (heldKey.current) swallowHeldKey(heldKey.current);
        heldKey.current = null;
      }
      hold.current = state;
      const { fill, spent } = sample(state, now);
      const span = FILL_BOTTOM - FILL_TOP;
      riseRef.current?.setAttribute("y", String(FILL_BOTTOM - span * fill));
      riseRef.current?.setAttribute("height", String(Math.max(0, span * (fill - spent))));
      buttonRef.current?.setAttribute("data-hold-progress", fill.toFixed(3));
      setMarkHold({ fill, spent, hidden: openRef.current });
      frame = state.phase === "idle" ? 0 : requestAnimationFrame(tick);
    };
    kick.current = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };
    return () => {
      cancelAnimationFrame(frame);
      setMarkHold(MARK_HOLD_IDLE);
    };
  }, []);

  const now = () => performance.now();
  const arm = () => {
    if (armed) return;
    void loadCard();
    setArmed(true);
  };
  const begin = (source: HoldSource) => {
    arm();
    if (openRef.current) return;
    hold.current = press(hold.current, now(), source);
    kick.current();
  };
  const stop = () => {
    hold.current = cancel(hold.current, now());
    kick.current();
  };
  const grow = () => {
    arm();
    const size = buttonRef.current?.offsetWidth ?? 32;
    setScale((size + MARK.growPx) / size);
  };
  // The ring returns when the dialog's exit ends, never over the fading card.
  const close = () => {
    openRef.current = false;
    hold.current = { ...hold.current, swallowClick: false };
    setOpen(false);
  };
  const exited = () => {
    if (!openRef.current && hold.current.phase === "idle") setMarkHold(MARK_HOLD_IDLE);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={ariaLabel}
        data-cursor-hover
        data-mark-trigger=""
        data-hold-progress="0.000"
        className={`${className} touch-none select-none [-webkit-touch-callout:none]`}
        onPointerDown={(e) => {
          if (e.button === 0) begin("pointer");
        }}
        onPointerUp={() => {
          hold.current = release(hold.current, now());
          kick.current();
        }}
        onPointerCancel={stop}
        onPointerEnter={grow}
        onPointerLeave={() => {
          setScale(1);
          stop();
        }}
        onFocus={(e) => (e.currentTarget.matches(":focus-visible") ? grow() : arm())}
        onBlur={() => setScale(1)}
        onContextMenu={(e) => e.preventDefault()}
        onClick={(e) => {
          const result = click(advance(hold.current, now()));
          hold.current = result.state;
          if (result.swallow) e.preventDefault();
          else onActivate();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") return stop();
          if (!HOLD_KEYS.has(e.key)) return;
          e.preventDefault();
          if (e.repeat) return;
          heldKey.current = e.key;
          begin("key");
        }}
        onKeyUp={(e) => {
          if (!HOLD_KEYS.has(e.key)) return;
          e.preventDefault();
          heldKey.current = null;
          const at = now();
          const wasFilling = advance(hold.current, at).phase === "filling";
          hold.current = release(hold.current, at);
          kick.current();
          if (wasFilling) onActivate();
        }}
      >
        <span
          className="relative block h-full w-full"
          style={{ transform: `scale(${scale})`, transformOrigin: "0 0", transition: reduced ? "none" : `transform ${MARK.growMs}ms ${MARK.ease}` }}
        >
          <AsMark className="block h-full w-full" />
          <svg viewBox={VIEW_BOX} aria-hidden="true" focusable="false" className="absolute inset-0 h-full w-full fill-accent">
            <defs>
              <clipPath id={clipId}>
                <rect ref={riseRef} x="0" y={FILL_BOTTOM} width="260" height="0" />
              </clipPath>
            </defs>
            <g clipPath={`url(#${clipId})`}>
              <path d={BOLT_D} />
              <path d={LEG_D} />
              <path d={BAR_D} />
            </g>
          </svg>
        </span>
      </button>
      {armed && <MarkCard open={open} onClose={close} onExited={exited} />}
    </>
  );
}
