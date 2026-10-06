"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { gsap } from "gsap";
import { BAR_D, BAR_REVEAL_D, BOLT_D, BOLT_REVEAL_D, BOLT_REVEAL_WIDTH, LEG_D, LEG_REVEAL_D, VIEW_BOX } from "./geometry";
import { CursorStandIn, paintRing, ringActive } from "./Cursor";
import { CURSOR_LABELS, FILL_LABELS, TRIGGER_LABELS, type Settings } from "./settings";
import { Caption, Check } from "./ui";

// The top-left corner at its real size: SiteNav's mark (left-6 top-5, 32px;
// 26px under sm) over a stand-in hero, with a stand-in for the site cursor.
//
// Hover invites: the mark grows a few pixels from its own top-left corner, on
// the site's ease. A press fills it two-tone the way the loader fills "Aaron":
// the mark keeps its resting tone and a hard-edged copy in the accent rises
// through it. The fill starts on pointer down, with no dead zone. Let go early
// and a short tap still shows a taste (a minimum fill, held a moment) before it
// drains, and the ordinary click still happens. Hold to the end and the charge
// discharges up out of the top, and the strike answers in the card. When the
// cursor rings the mark, paint() also draws the ring's wash and arc from the
// same band, so the mark and the ring can never disagree.

const SITE_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const MARK_TOP = 22;
const MARK_BOTTOM = 234;
const BOLT_SHARE = 0.62;
const DISCHARGE_S = 0.14;
const TASTE_RISE_S = 0.09;

type Phase = "idle" | "filling" | "taste" | "draining" | "fired";

export function TriggerCorner({ s, reduced, cardOpen, onOpen }: { s: Settings; reduced: boolean; cardOpen: boolean; onOpen: () => void }) {
  const [atTop, setAtTop] = useState(true);
  const [phone, setPhone] = useState(false);
  const [note, setNote] = useState("Waiting.");
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [pointer, setPointer] = useState<{ x: number; y: number; inside: boolean }>({ x: 0, y: 0, inside: false });
  const id = useId().replace(/:/g, "");
  const boxRef = useRef<HTMLDivElement | null>(null);
  const riseRef = useRef<SVGRectElement | null>(null);
  const boltRef = useRef<SVGPathElement | null>(null);
  const legRef = useRef<SVGPathElement | null>(null);
  const barRef = useRef<SVGPathElement | null>(null);
  const fill = useRef({ p: 0, q: 0 });
  const phase = useRef<Phase>("idle");
  const tween = useRef<gsap.core.Timeline | gsap.core.Tween | null>(null);
  const fired = useRef(false);
  const struck = useRef(false);
  const ringRootRef = useRef<SVGSVGElement | null>(null);
  const ringWashRef = useRef<SVGRectElement | null>(null);
  const ringArcRef = useRef<SVGCircleElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const size = phone ? 26 : 32;
  const grown = s.hint === "grow" && (hover || focus);
  const scale = grown ? (size + s.growPx) / size : 1;

  // Paints the fill band [q, p] of the mark in the accent: a clip for the
  // loader's rise, dashes on reveal strokes for the run down the bolt.
  const paint = () => {
    const { p, q } = fill.current;
    const rise = riseRef.current;
    if (rise) {
      const top = MARK_BOTTOM - (MARK_BOTTOM - MARK_TOP) * p;
      const bottom = MARK_BOTTOM - (MARK_BOTTOM - MARK_TOP) * q;
      rise.setAttribute("y", String(top));
      rise.setAttribute("height", String(Math.max(0, bottom - top)));
    }
    const band = (path: SVGPathElement | null, from: number, to: number) => {
      if (!path) return;
      const total = path.getTotalLength();
      const a = Math.min(1, Math.max(0, (q - from) / (to - from)));
      const b = Math.min(1, Math.max(0, (p - from) / (to - from)));
      path.style.strokeDasharray = `0 ${a * total} ${(b - a) * total} ${total}`;
    };
    band(boltRef.current, 0, BOLT_SHARE);
    band(legRef.current, BOLT_SHARE, 1);
    band(barRef.current, BOLT_SHARE + (1 - BOLT_SHARE) * 0.55, 1);
    buttonRef.current?.setAttribute("data-hold-progress", p.toFixed(3));
    const striking = phase.current === "fired";
    paintRing({ root: ringRootRef, wash: ringWashRef, arc: ringArcRef }, s, reduced, fill.current, striking && s.ringAtStrike === "closes", cardOpen || struck.current || (striking && s.ringAtStrike === "vanishes"));
  };
  const paintRef = useRef(paint);

  useLayoutEffect(() => {
    paintRef.current = paint;
    paint();
  });

  useEffect(() => {
    if (!cardOpen) struck.current = false;
  }, [cardOpen]);

  useEffect(
    () => () => {
      tween.current?.kill();
      document.documentElement.classList.remove("mark-lab-cursor");
    },
    [],
  );

  const repaint = () => paintRef.current();
  const today = () => setNote(atTop ? "The ordinary click: at the top it does nothing." : "The ordinary click: a smooth scroll to the top, as today.");

  const fire = () => {
    phase.current = "fired";
    fired.current = true;
    setNote(`Opened by a ${s.holdMs}ms hold.`);
    tween.current = gsap.to(fill.current, {
      q: 1,
      duration: DISCHARGE_S,
      ease: "power2.in",
      onUpdate: repaint,
      onComplete: () => {
        struck.current = true;
        fill.current = { p: 0, q: 0 };
        phase.current = "idle";
        repaint();
        onOpen();
      },
    });
  };

  const press = () => {
    if (s.trigger !== "hold" || phase.current === "fired") return;
    tween.current?.kill();
    fired.current = false;
    struck.current = false;
    phase.current = "filling";
    fill.current.q = 0;
    tween.current = gsap.to(fill.current, {
      p: 1,
      duration: (s.holdMs / 1000) * (1 - fill.current.p),
      ease: "none",
      onUpdate: repaint,
      onComplete: fire,
    });
  };

  const drain = () => {
    phase.current = "draining";
    tween.current = gsap.to(fill.current, {
      p: 0,
      duration: (s.drainMs / 1000) * Math.max(0.3, fill.current.p),
      ease: "power2.in",
      onUpdate: repaint,
      onComplete: () => {
        phase.current = "idle";
      },
    });
  };

  // An early release: guarantee the taste, then drain.
  const release = () => {
    if (phase.current !== "filling") return;
    tween.current?.kill();
    phase.current = "taste";
    const target = Math.max(fill.current.p, s.minFill);
    const tl = gsap.timeline({ onComplete: drain });
    if (target > fill.current.p) tl.to(fill.current, { p: target, duration: TASTE_RISE_S, ease: "power2.out", onUpdate: repaint });
    tl.to({}, { duration: s.tasteMs / 1000 });
    tween.current = tl;
  };

  const abandon = () => {
    if (phase.current !== "filling") return;
    tween.current?.kill();
    drain();
  };

  const onClick = () => {
    if (fired.current) {
      fired.current = false;
      return;
    }
    if (s.trigger === "click-at-top" && atTop) {
      setNote("Opened by a click at the top.");
      return onOpen();
    }
    today();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key !== "Enter" && e.key !== " ") || s.trigger !== "hold") return;
    e.preventDefault();
    if (!e.repeat) press();
  };
  const onKeyUp = (e: React.KeyboardEvent) => {
    if ((e.key !== "Enter" && e.key !== " ") || s.trigger !== "hold") return;
    e.preventDefault();
    if (phase.current === "filling") {
      release();
      today();
    }
    fired.current = false;
  };

  const track = (e: React.PointerEvent) => {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;
    setPointer({ x: e.clientX - box.left, y: e.clientY - box.top, inside: true });
  };

  const markStyle: CSSProperties = {
    transform: `scale(${scale})`,
    transformOrigin: "0 0",
    transition: `transform ${s.growMs}ms ${SITE_EASE}`,
  };
  const dash = { strokeDasharray: "0 1" };

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={boxRef}
        onPointerEnter={(e) => {
          document.documentElement.classList.add("mark-lab-cursor");
          track(e);
        }}
        onPointerMove={track}
        onPointerLeave={() => {
          document.documentElement.classList.remove("mark-lab-cursor");
          setPointer((v) => ({ ...v, inside: false }));
        }}
        className="relative h-[240px] cursor-none overflow-hidden rounded-2xl [box-shadow:inset_0_0_0_1px_var(--color-border)]"
      >
        <style>{`html.mark-lab-cursor .z-\\[100\\]{opacity:0!important}`}</style>
        <p aria-hidden="true" className="pointer-events-none absolute -bottom-6 left-1/2 -translate-x-1/2 select-none font-display text-display-name leading-none text-border">
          Aaron
        </p>
        {!atTop && <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[72px] border-b border-border bg-[var(--nav-bar)]" />}
        <button
          ref={buttonRef}
          type="button"
          data-hold-progress="0.000"
          aria-label="Back to the top (lab copy)"
          onClick={onClick}
          onDoubleClick={() => {
            if (s.trigger === "double-click" && atTop) {
              setNote("Opened by a double click at the top.");
              onOpen();
            }
          }}
          onPointerDown={(e) => {
            if (e.button === 0) press();
          }}
          onPointerUp={release}
          onPointerLeave={() => {
            setHover(false);
            abandon();
          }}
          onPointerCancel={abandon}
          onPointerEnter={() => setHover(true)}
          onFocus={(e) => setFocus(e.currentTarget.matches(":focus-visible"))}
          onBlur={() => setFocus(false)}
          onKeyDown={onKeyDown}
          onKeyUp={onKeyUp}
          onContextMenu={(e) => {
            if (s.trigger === "hold") e.preventDefault();
          }}
          style={markStyle}
          className={`absolute z-10 block cursor-none touch-manipulation select-none text-foreground [-webkit-touch-callout:none] ${
            phone ? "left-4 top-[18px] h-[26px] w-[26px]" : "left-6 top-5 h-8 w-8"
          }`}
        >
          <svg viewBox={VIEW_BOX} aria-hidden="true" focusable="false" className="block h-full w-full">
            <defs>
              <clipPath id={`${id}-rise`}>
                <rect ref={riseRef} x="0" y={MARK_BOTTOM} width="260" height="0" />
              </clipPath>
              <mask id={`${id}-bolt`} maskUnits="userSpaceOnUse" x="0" y="0" width="260" height="260">
                <path ref={boltRef} d={BOLT_REVEAL_D} fill="none" stroke="white" strokeWidth={BOLT_REVEAL_WIDTH} strokeLinejoin="miter" strokeMiterlimit={8} style={dash} />
                <path ref={legRef} d={LEG_REVEAL_D} fill="none" stroke="white" strokeWidth="20" strokeLinejoin="round" style={dash} />
                <path ref={barRef} d={BAR_REVEAL_D} fill="none" stroke="white" strokeWidth="13" style={dash} />
              </mask>
            </defs>
            <path d={BOLT_D} fill="currentColor" />
            <path d={LEG_D} fill="currentColor" />
            <path d={BAR_D} fill="currentColor" />
            <g className="fill-accent" {...(s.fillDirection === "rise" ? { clipPath: `url(#${id}-rise)` } : { mask: `url(#${id}-bolt)` })}>
              <path d={BOLT_D} />
              <path d={LEG_D} />
              <path d={BAR_D} />
            </g>
          </svg>
        </button>
        <CursorStandIn s={s} rootRef={ringRootRef} washRef={ringWashRef} arcRef={ringArcRef} reduced={reduced} pointer={pointer} overMark={hover} markSize={size * scale} markLeft={phone ? 16 : 24} markTop={phone ? 18 : 20} />
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] [font-family:system-ui]">
        <Check label="Page is at the top" checked={atTop} onChange={setAtTop} />
        <Check label="Phone size (26px)" checked={phone} onChange={setPhone} />
        <span className="text-muted">
          {TRIGGER_LABELS[s.trigger]}, {s.trigger === "hold" ? FILL_LABELS[s.fillDirection].toLowerCase() : "no fill"}, cursor: {CURSOR_LABELS[s.cursor].toLowerCase()}
          {ringActive(s, reduced) ? `, the ring shows the hold (${s.ringArcDegrees} degrees at full)` : ""}. {note}
        </span>
      </div>
      <Caption>
        Hover (or tab to it) and the mark grows {s.growPx}px from its top-left corner. Press and it fills at once; a quick click shows at least {Math.round(s.minFill * 100)}%
        for {s.tasteMs}ms and drains over {s.drainMs}ms, and the ordinary click still happens. Hold {s.holdMs}ms and the charge leaves through the top, then the card
        opens with the strike. Enter or Space held on the focused mark does the same; on touch it is a long press with the callout suppressed.
        {ringActive(s, reduced)
          ? ` Ringed, the cursor shows the same hold: a ${Math.round(s.ringFillStrength * 100)}% wash rises inside it and an arc draws to ${s.ringArcDegrees} degrees, and at the strike the circle ${s.ringAtStrike === "closes" ? "closes, then goes with the card" : "vanishes"}.`
          : ""}
      </Caption>
    </div>
  );
}
