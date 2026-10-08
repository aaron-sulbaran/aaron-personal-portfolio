"use client";

import { useEffect, useId, useRef } from "react";
import { MARK_HOLD_IDLE, getMarkHold, subscribeMarkHold } from "@/lib/cursor/hover";
import { RING } from "@/lib/mark/constants";
import { ringPaint } from "@/lib/mark/ring";

// The cursor over the mark: a ring around the grown mark that shows the
// hold, painted from the hover store's markHold (the fill MarkTrigger
// publishes), so the ring and the mark never disagree. Reduced motion: the
// plain ring. Hidden while the card is open.
export function MarkRing({ diameter, reduced }: { diameter: number; reduced: boolean }) {
  const clipId = `${useId().replace(/:/g, "")}-wash`;
  const rootRef = useRef<SVGSVGElement>(null);
  const washRef = useRef<SVGRectElement>(null);
  const arcRef = useRef<SVGCircleElement>(null);
  const unit = 100 / diameter;
  const base = RING.baseStrokePx * unit;
  const arcWidth = RING.arcStrokePx * unit;
  const arcRadius = 50 - arcWidth / 2;

  useEffect(() => {
    const paint = () => {
      const root = rootRef.current;
      const wash = washRef.current;
      const arc = arcRef.current;
      if (!root || !wash || !arc) return;
      const hold = getMarkHold();
      const frame = ringPaint(reduced ? MARK_HOLD_IDLE : hold, arcWidth, arcRadius);
      root.style.opacity = hold.hidden ? "0" : "1";
      root.dataset.ringArc = frame.arcDegrees.toFixed(1);
      wash.setAttribute("y", String(frame.washTop));
      wash.setAttribute("height", String(frame.washHeight));
      arc.style.visibility = frame.arcVisible ? "visible" : "hidden";
      arc.style.strokeDasharray = frame.dashArray;
      arc.style.strokeDashoffset = frame.dashOffset;
    };
    paint();
    return subscribeMarkHold(paint);
  }, [reduced, arcWidth, arcRadius]);

  return (
    <svg
      ref={rootRef}
      data-mark-ring=""
      viewBox="0 0 100 100"
      overflow="visible"
      className={`absolute left-0 top-0 block -translate-x-1/2 -translate-y-1/2 text-accent ${reduced ? "" : "transition-[width,height] duration-200 ease-out"}`}
      style={{ width: diameter, height: diameter }}
    >
      <defs>
        <clipPath id={clipId}>
          <rect ref={washRef} x="0" y="100" width="100" height="0" />
        </clipPath>
      </defs>
      <circle cx="50" cy="50" r={50 - base} clipPath={`url(#${clipId})`} className="fill-accent" fillOpacity={RING.tint} />
      <circle cx="50" cy="50" r={50 - base / 2} fill="none" stroke="currentColor" strokeWidth={base} />
      <circle
        ref={arcRef}
        cx="50"
        cy="50"
        r={arcRadius}
        fill="none"
        stroke="currentColor"
        strokeWidth={arcWidth}
        strokeLinecap="round"
        pathLength={360}
        transform="rotate(-90 50 50)"
        style={{ visibility: "hidden", strokeDasharray: "0 360" }}
      />
    </svg>
  );
}
