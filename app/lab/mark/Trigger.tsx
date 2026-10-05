"use client";

import { useEffect, useId, useRef, useState } from "react";
import { gsap } from "gsap";
import { BAR_D, BOLT_D, LEG_D, VIEW_BOX } from "./geometry";
import { HINT_LABELS, TRIGGER_LABELS, type Settings } from "./settings";
import { Caption, Check, Chip } from "./ui";

// The top-left corner at its real size: SiteNav's mark button (left-6 top-5,
// 32px; 26px under sm) over a stand-in hero. The mark is drawn from the same
// three paths so it can charge; at rest it is the flat mark. Every trigger
// leaves today's click alone: below the top, a click still goes home.

// Ordinary clicks finish well inside this, so a normal click never shows the
// charge at all.
const CHARGE_DEAD_ZONE_MS = 160;

export function TriggerCorner({ s, onOpen }: { s: Settings; onOpen: () => void }) {
  const [atTop, setAtTop] = useState(true);
  const [phone, setPhone] = useState(false);
  const [note, setNote] = useState("Waiting.");
  const [hinted, setHinted] = useState(false);
  const clipId = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement | null>(null);
  const levelRef = useRef<SVGRectElement | null>(null);
  const glintRef = useRef<SVGPathElement | null>(null);
  const charge = useRef<{ tween: gsap.core.Tween | null; fired: boolean; timer: number }>({ tween: null, fired: false, timer: 0 });

  useEffect(() => () => {
    window.clearTimeout(charge.current.timer);
    charge.current.tween?.kill();
  }, []);

  const level = (p: number) => {
    const rect = levelRef.current;
    if (!rect) return;
    const height = 210 * p;
    rect.setAttribute("y", String(231 - height));
    rect.setAttribute("height", String(height));
  };

  const today = () => setNote(atTop ? "Today: at the top this click does nothing." : "Today: smooth scroll to the top, as it does now.");

  const open = (how: string) => {
    setNote(`Opened by ${how}.`);
    onOpen();
  };

  const onClick = () => {
    if (s.trigger === "hold") {
      if (charge.current.fired) {
        charge.current.fired = false;
        return;
      }
      today();
      return;
    }
    if (s.trigger === "click-at-top" && atTop) return open("a click at the top");
    today();
  };

  const onDoubleClick = () => {
    if (s.trigger === "double-click" && atTop) open("a double click at the top");
  };

  const startHold = () => {
    if (s.trigger !== "hold") return;
    const c = charge.current;
    c.tween?.kill();
    c.fired = false;
    const state = { p: 0 };
    c.timer = window.setTimeout(() => {
      c.tween = gsap.to(state, {
        p: 1,
        duration: Math.max(s.holdMs - CHARGE_DEAD_ZONE_MS, 120) / 1000,
        ease: "power1.in",
        onUpdate: () => level(state.p),
        onComplete: () => {
          c.fired = true;
          level(0);
          open(`a ${s.holdMs}ms hold`);
        },
      });
    }, CHARGE_DEAD_ZONE_MS);
  };

  const endHold = () => {
    const c = charge.current;
    window.clearTimeout(c.timer);
    if (!c.tween || c.fired) return;
    const rect = levelRef.current;
    const current = rect ? Number(rect.getAttribute("height") || 0) / 210 : 0;
    c.tween.kill();
    const state = { p: current };
    c.tween = gsap.to(state, { p: 0, duration: 0.22, ease: "power2.out", onUpdate: () => level(state.p) });
  };

  const onEnter = () => {
    if (s.hint === "none" || hinted) return;
    setHinted(true);
    if (s.hint === "twitch" && svgRef.current) {
      gsap.fromTo(svgRef.current, { y: 0 }, { keyframes: { y: [0, 1.5, -0.75, 0.4, 0] }, duration: 0.24, ease: "none" });
    }
    if (s.hint === "glint" && glintRef.current) {
      gsap.fromTo(glintRef.current, { opacity: 0 }, { keyframes: { opacity: [0, 1, 0] }, duration: 0.3, ease: "power1.inOut" });
    }
  };

  const size = phone ? "left-4 top-[18px] h-[26px] w-[26px]" : "left-6 top-5 h-8 w-8";

  return (
    <div className="flex flex-col gap-4">
      <div className="relative h-[240px] overflow-hidden rounded-2xl [box-shadow:inset_0_0_0_1px_var(--color-border)]">
        <p aria-hidden="true" className="pointer-events-none absolute -bottom-6 left-1/2 -translate-x-1/2 select-none font-display text-display-name leading-none text-border">
          Aaron
        </p>
        {!atTop && <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[72px] border-b border-border bg-[var(--nav-bar)]" />}
        <button
          type="button"
          aria-label="Back to the top (lab copy)"
          onClick={onClick}
          onDoubleClick={onDoubleClick}
          onPointerDown={startHold}
          onPointerUp={endHold}
          onPointerLeave={endHold}
          onPointerCancel={endHold}
          onContextMenu={(e) => s.trigger === "hold" && e.preventDefault()}
          onPointerEnter={onEnter}
          className={`absolute z-10 block select-none text-foreground [-webkit-touch-callout:none] ${size}`}
        >
          <svg ref={svgRef} viewBox={VIEW_BOX} aria-hidden="true" focusable="false" className="block h-full w-full">
            <defs>
              <clipPath id={clipId}>
                <rect ref={levelRef} x="0" y="231" width="260" height="0" />
              </clipPath>
            </defs>
            <path d={BOLT_D} fill="currentColor" />
            <path d={LEG_D} fill="currentColor" />
            <path d={BAR_D} fill="currentColor" />
            <path d={BOLT_D} className="fill-accent" clipPath={`url(#${clipId})`} />
            <path ref={glintRef} d={BOLT_D} className="fill-accent" opacity="0" />
          </svg>
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] [font-family:system-ui]">
        <Check label="Page is at the top" checked={atTop} onChange={setAtTop} />
        <Check label="Phone size (26px)" checked={phone} onChange={setPhone} />
        <Chip onClick={() => setHinted(false)}>Reset the hint</Chip>
        <span className="text-muted">
          {TRIGGER_LABELS[s.trigger]}, {HINT_LABELS[s.hint].toLowerCase()}. {note}
        </span>
      </div>
      <Caption>
        The mark is at its real size and position. Click at the top: the click that does nothing today. Double click: only at the top, since below it the first click
        already starts the scroll home. Press and hold: the bolt charges in the accent after a {CHARGE_DEAD_ZONE_MS}ms dead zone, so a normal click never shows it;
        let go early and it drains.
      </Caption>
    </div>
  );
}
