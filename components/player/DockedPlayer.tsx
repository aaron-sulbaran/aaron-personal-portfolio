"use client";

import { useEffect, useRef, useState } from "react";
import { Portal } from "@/components/Portal";
import { EASE } from "@/components/soundtrack/PillParts";
import { useEscapeKey } from "@/lib/modal";
import { DOCK } from "@/lib/waveform/dock";
import type { OnPlay } from "@/lib/player/settings";
import { playerStrings } from "@/lib/content/playerLab";
import { Surface } from "./Surface";

type Props = { variant: Exclude<OnPlay, "today">; credit: boolean; reduce: boolean; lifted: boolean; onClose: () => void };

// In the hero the Coil and Band toggle holds the pill's dock line, so the card stands this far above it there.
const HERO_LIFT_PX = 56;

// The player at the isle's dock, bottom left on the pill's own line, for a
// player started away from the band or opened from the pill. Non-modal: no
// scrim, no scroll lock, the page stays usable. Portaled to body so no
// transformed ancestor captures it; Escape and its button collapse it to the
// pill. The pill steps away while it stands here (the bridge), so the two
// never overlap.
export function DockedPlayer({ variant, credit, reduce, lifted, onClose }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    ref.current?.focus({ preventScroll: true });
    return () => cancelAnimationFrame(frame);
  }, []);
  useEscapeKey(true, onClose);

  return (
    <Portal>
      <div
        ref={ref}
        tabIndex={-1}
        data-lab-docked
        style={{
          position: "fixed",
          left: DOCK.insetPx,
          bottom: DOCK.baselineFromBottomPx - DOCK.capsulePx / 2 + (lifted ? HERO_LIFT_PX : 0),
          zIndex: 45,
          width: variant === "sheet" ? 340 : 360,
          maxWidth: `calc(100vw - ${DOCK.insetPx * 2}px)`,
          outline: "none",
          transformOrigin: "bottom left",
          opacity: entered ? 1 : 0,
          transform: reduce || entered ? "none" : "translateY(10px) scale(0.96)",
          transition: reduce ? "opacity 200ms ease" : `opacity 260ms ease, transform 320ms ${EASE}, bottom 280ms ${EASE}`,
        }}
      >
        <Surface variant={variant} layout="stack" credit={credit} active reduce={reduce} closeLabel={playerStrings.collapse} onClose={onClose} />
      </div>
    </Portal>
  );
}
