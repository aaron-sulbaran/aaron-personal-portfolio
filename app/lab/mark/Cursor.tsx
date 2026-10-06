"use client";

import type { RefObject } from "react";
import type { Settings } from "./settings";

// A stand-in for components/CustomCursor (a 10px accent dot that becomes a
// 22px ring over anything clickable), and four answers for the mark. When it
// rings the mark, the ring can also show the hold: an accent wash rising
// through its interior and an arc drawn on its stroke, both painted from the
// trigger's own fill progress (one clock), never from a tween of their own.

const SITE_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
export const RING_PAD = 14;
const BASE_RING_PX = 1.5;
// The bump peaks at 5/6 of the hold, 12% past the arc's extent, and settles
// back onto it at full: r^5 (1 - r) normalised to 1 at its peak.
const BUMP = 0.29;
const BUMP_PEAK = Math.pow(5 / 6, 5) / 6;

export type RingRefs = {
  root: RefObject<SVGSVGElement | null>;
  wash: RefObject<SVGRectElement | null>;
  arc: RefObject<SVGCircleElement | null>;
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

// The ring's progress from the mark's: equal at press and at full, offset by
// the lead (in ms of the hold) at mid hold. Monotonic while |lead| / hold is
// under 1 / pi, which the panel's ranges (120ms, 400ms) keep.
export function ringProgress(p: number, s: Pick<Settings, "ringLead" | "holdMs">) {
  const x = clamp01(p);
  return clamp01(x + (s.ringLead / s.holdMs) * Math.sin(Math.PI * x));
}

export function arcShare(r: number, ease: Settings["ringArcEase"]) {
  if (ease === "none") return r;
  return Math.max(0, r + (BUMP * Math.pow(r, 5) * (1 - r)) / BUMP_PEAK);
}

export function ringActive(s: Settings, reduced: boolean) {
  return s.cursor === "ring" && s.trigger === "hold" && s.ringIndicator && !reduced;
}

// p and q are the mark's fill band (q only rises in the discharge). closed
// is the strike's frame: the arc goes to a full circle. hidden drops the
// whole ring (a vanishing strike, or the card is open over it).
export function paintRing(refs: RingRefs, s: Settings, reduced: boolean, band: { p: number; q: number }, closed: boolean, hidden: boolean) {
  const root = refs.root.current;
  if (!root) return;
  const active = ringActive(s, reduced);
  const r = active ? ringProgress(band.p, s) : 0;
  const rq = active ? ringProgress(band.q, s) : 0;
  const degrees = !active ? 0 : closed ? 360 : Math.min(360, s.ringArcDegrees * arcShare(r, s.ringArcEase));
  root.dataset.ringProgress = r.toFixed(3);
  root.dataset.ringArc = degrees.toFixed(1);
  root.style.opacity = hidden ? "0" : "1";

  const wash = refs.wash.current;
  if (wash) {
    const top = 100 * (1 - (active && s.ringFill ? r : 0));
    const bottom = 100 * (1 - (active && s.ringFill ? rq : 0));
    wash.setAttribute("y", String(top));
    wash.setAttribute("height", String(Math.max(0, bottom - top)));
  }
  const arc = refs.arc.current;
  if (arc) {
    // Round caps overhang each end by half the stroke; pull the dash in by
    // that much (in the circle's 360 path units) so 12 o'clock is the true start.
    const width = Number(arc.getAttribute("stroke-width"));
    const radius = Number(arc.getAttribute("r"));
    const cap = degrees >= 360 ? 0 : (width / 2 / (2 * Math.PI * radius)) * 360;
    const dash = Math.max(0.001, degrees - 2 * cap);
    arc.style.visibility = degrees < 0.5 ? "hidden" : "visible";
    arc.style.strokeDasharray = `${dash} ${360 - dash}`;
    arc.style.strokeDashoffset = String(s.ringArcStart === "fill" ? dash / 2 : -cap);
  }
}

export function CursorStandIn({
  s,
  rootRef,
  washRef,
  arcRef,
  pointer,
  overMark,
  markSize,
  markLeft,
  markTop,
  reduced,
}: {
  s: Settings;
  rootRef: RingRefs["root"];
  washRef: RingRefs["wash"];
  arcRef: RingRefs["arc"];
  pointer: { x: number; y: number; inside: boolean };
  overMark: boolean;
  markSize: number;
  markLeft: number;
  markTop: number;
  reduced: boolean;
}) {
  let x = pointer.x;
  let y = pointer.y;
  let diameter = 10;
  let ring = false;
  const ringsMark = overMark && s.cursor === "ring";
  if (overMark) {
    if (s.cursor === "today") {
      diameter = 22;
      ring = true;
    } else if (s.cursor === "dot") {
      diameter = 4;
    } else if (s.cursor === "aside") {
      x += 18;
      y += 18;
      diameter = 8;
    } else {
      x = markLeft + markSize / 2;
      y = markTop + markSize / 2;
      diameter = markSize + RING_PAD;
    }
  }
  const unit = 100 / diameter;
  const base = BASE_RING_PX * unit;
  const arcWidth = Math.max(s.ringArcWidth, BASE_RING_PX) * unit;
  const arcRotation = s.ringArcStart === "fill" ? 90 : -90;
  const moveTransition = ringsMark && !reduced ? `transform 200ms ${SITE_EASE}` : "none";

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute left-0 top-0 z-20"
      style={{ transform: `translate(${x}px, ${y}px)`, opacity: pointer.inside ? 1 : 0, transition: moveTransition }}
    >
      {ringsMark ? (
        <svg
          ref={rootRef}
          data-mark-ring=""
          viewBox="0 0 100 100"
          overflow="visible"
          className={`block -translate-x-1/2 -translate-y-1/2 text-accent ${reduced ? "" : "transition-[width,height] duration-200 ease-out"}`}
          style={{ width: diameter, height: diameter }}
        >
          <defs>
            <clipPath id="mark-ring-rise">
              <rect ref={washRef} x="0" y="100" width="100" height="0" />
            </clipPath>
          </defs>
          <circle
            cx="50"
            cy="50"
            r={50 - base}
            clipPath="url(#mark-ring-rise)"
            className={s.ringFillTone === "accent" ? "fill-accent" : "fill-foreground"}
            fillOpacity={s.ringFillStrength}
          />
          <circle cx="50" cy="50" r={50 - base / 2} fill="none" stroke="currentColor" strokeWidth={base} />
          <circle
            ref={arcRef}
            cx="50"
            cy="50"
            r={50 - arcWidth / 2}
            fill="none"
            stroke="currentColor"
            strokeWidth={arcWidth}
            strokeLinecap="round"
            pathLength={360}
            transform={`rotate(${arcRotation} 50 50)`}
            style={{ visibility: "hidden", strokeDasharray: "0 360" }}
          />
        </svg>
      ) : (
        <span
          className={`block -translate-x-1/2 -translate-y-1/2 rounded-full transition-[width,height] duration-200 ease-out ${ring ? "border-[1.5px] border-accent" : "bg-accent"}`}
          style={{ width: diameter, height: diameter }}
        />
      )}
    </div>
  );
}
