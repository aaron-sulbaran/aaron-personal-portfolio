import type { CSSProperties, Ref } from "react";
import type { PulseGeometry } from "@/lib/home/dealPulse";

// The click's ring: one soft accent ring that spreads from "Deal me in" across
// the strip at page 1's foot while the cards rush in, whole at every size (the
// layer clips nothing; lib/home/dealPulse.ts keeps it inside the strip's
// height). Transform and opacity only, the accent token only, no pointer, hidden
// from assistive tech. The layer is always there (the button measures against
// it); a ring is added per click and keyed so each click starts a fresh one.
// Reduced motion shows none (app/globals.css). It renders from IntroCta's state.
export type Pulse = PulseGeometry & { key: number; ms: number; strength: number };

export function DealPulse({ pulse, layerRef, onDone }: { pulse: Pulse | null; layerRef: Ref<HTMLSpanElement>; onDone: () => void }) {
  return (
    <span ref={layerRef} aria-hidden="true" data-deal-pulse="" className="deal-pulse">
      {pulse && (
        <span
          key={pulse.key}
          data-deal-ring=""
          className="deal-pulse__ring"
          onAnimationEnd={onDone}
          style={
            {
              "--pulse-x": `${pulse.x}px`,
              "--pulse-y": `${pulse.y}px`,
              "--pulse-size": `${pulse.size}px`,
              "--pulse-height": `${pulse.height}px`,
              "--pulse-ms": `${pulse.ms}ms`,
              "--pulse-strength": pulse.strength,
            } as CSSProperties
          }
        />
      )}
    </span>
  );
}
