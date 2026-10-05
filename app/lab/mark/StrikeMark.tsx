"use client";

import { forwardRef, useId } from "react";
import { AsMark } from "@/components/menu/BrandMark";
import {
  A_RISE_FROM,
  BAR_D,
  BAR_REVEAL_D,
  BAR_REVEAL_WIDTH,
  BOLT_D,
  BOLT_REVEAL_D,
  BOLT_REVEAL_WIDTH,
  BOLT_SPINE_D,
  GROUND_Y,
  IMPACT,
  LEG_D,
  LEG_REVEAL_D,
  LEG_REVEAL_WIDTH,
  SPLASH_DOTS,
  VIEW_BOX,
} from "./geometry";
import type { StrikeSettings } from "./settings";

// The animated copy of the mark plus the real AsMark on top of it. Masks are
// white strokes (mask luminance, not a color); every visible ink is
// currentColor through text-foreground or text-accent. The fx group sits
// under the mark so the splash never crosses the letter.
type Props = { s: StrikeSettings; sizePx: number; className?: string };

export const StrikeMark = forwardRef<HTMLDivElement, Props>(function StrikeMark({ s, sizePx, className = "" }, ref) {
  const id = useId().replace(/:/g, "");
  const boltMask = `${id}-bolt`;
  const aMask = `${id}-a`;
  const fxTone = s.effect === "accent" ? "text-accent" : "text-foreground";
  // One mask over the whole A, never one per path: the leg and the bar share
  // an edge, and masking them apart double-inks that seam against AsMark.
  const aMaskRef = s.a === "scorch" ? undefined : `url(#${aMask})`;

  return (
    <div ref={ref} className={`relative shrink-0 ${className}`} style={{ width: sizePx, height: sizePx }}>
      <svg viewBox={VIEW_BOX} aria-hidden="true" focusable="false" className="absolute inset-0 h-full w-full overflow-visible text-foreground">
        <defs>
          <mask id={boltMask} maskUnits="userSpaceOnUse" x="0" y="0" width="260" height="260">
            <path data-part="bolt-reveal" d={BOLT_REVEAL_D} fill="none" stroke="white" strokeWidth={BOLT_REVEAL_WIDTH} strokeLinejoin="miter" strokeMiterlimit={8} />
          </mask>
          <mask id={aMask} maskUnits="userSpaceOnUse" x="0" y="0" width="260" height="260">
            {s.a === "trace" && (
              <>
                <path data-part="leg-reveal" d={LEG_REVEAL_D} fill="none" stroke="white" strokeWidth={LEG_REVEAL_WIDTH} strokeLinejoin="round" />
                <path data-part="bar-reveal" d={BAR_REVEAL_D} fill="none" stroke="white" strokeWidth={BAR_REVEAL_WIDTH} />
              </>
            )}
            {s.a === "wipe" && <circle data-part="a-wipe" cx={IMPACT[0]} cy={IMPACT[1]} r="0" fill="white" />}
            {s.a === "rise" && <rect data-part="a-rise" x="0" y={A_RISE_FROM} width="260" height="140" fill="white" />}
          </mask>
        </defs>

        <g data-part="fx" className={fxTone}>
          {s.splash === "ring" && <ellipse data-part="ring" cx={IMPACT[0]} cy={GROUND_Y} rx="0" ry="0" fill="none" stroke="currentColor" opacity="0" />}
          {s.splash === "ripple" &&
            [0, 1, 2, 3].map((i) => (
              <line key={i} data-part="ripple" x1={IMPACT[0]} x2={IMPACT[0]} y1={GROUND_Y + 2.4} y2={GROUND_Y + 2.4} stroke="currentColor" strokeWidth={i < 2 ? 2.4 : 1.6} opacity="0" />
            ))}
          {s.splash === "dots" && SPLASH_DOTS.map((d, i) => <circle key={i} data-part="dot" cx={IMPACT[0]} cy={IMPACT[1]} r={d.r} fill="currentColor" opacity="0" />)}
        </g>

        <g data-part="anim-mark">
          <path d={BOLT_D} fill="currentColor" mask={`url(#${boltMask})`} />
          {s.strike === "leader" && <path data-part="leader" d={BOLT_SPINE_D} fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="miter" />}
          {s.a === "scorch" && (
            <g data-part="a-tint" className="text-accent" opacity="0">
              <path d={LEG_D} fill="currentColor" />
              <path d={BAR_D} fill="currentColor" />
            </g>
          )}
          <g data-part="a-ink" mask={aMaskRef}>
            <path d={LEG_D} fill="currentColor" />
            <path d={BAR_D} fill="currentColor" />
          </g>
        </g>
      </svg>
      <div data-part="rest" className="absolute inset-0 text-foreground">
        <AsMark className="block h-full w-full" />
      </div>
    </div>
  );
});
