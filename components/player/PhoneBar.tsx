"use client";

import { useEffect, useState } from "react";
import { Portal } from "@/components/Portal";
import { Cover, glass } from "@/components/soundtrack/PillParts";
import { MarqueeTitle } from "@/components/soundtrack/MarqueeTitle";
import { playerStrings } from "@/lib/content/playerLab";
import { navigateToSection } from "@/lib/scroll";
import { BAR } from "@/lib/player/zone";
import { PlayButton, StepButton } from "./PlayerBits";
import { usePlayerControls } from "./usePlayerControls";

// The phone's slim bar at the bottom of the screen: the cover, the title and
// artist (a press takes the reader back to the band), play and next. It is the
// isle on a phone, which has no pill. Portaled to body, on the pill's z level.
export function PhoneBar({ reduce }: { reduce: boolean }) {
  const controls = usePlayerControls(false);
  const [entered, setEntered] = useState(false);
  const { track } = controls;

  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <Portal>
      <div
        role="group"
        aria-label={playerStrings.barLabel}
        data-lab-bar
        data-marquee-scope
        style={{
          ...glass,
          position: "fixed",
          left: BAR.insetPx,
          right: BAR.insetPx,
          bottom: `calc(${BAR.bottomPx}px + env(safe-area-inset-bottom, 0px))`,
          height: BAR.heightPx,
          zIndex: 45,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "0 14px 0 10px",
          borderRadius: BAR.heightPx / 2,
          opacity: entered ? 1 : 0,
          transition: reduce ? "opacity 200ms ease" : "opacity 220ms ease",
        }}
      >
        <Cover size={36} cover={track.cover} title={track.title} />
        <button
          type="button"
          aria-label={`${playerStrings.goToPlayer}: ${track.title}`}
          onClick={() => navigateToSection("#listen", reduce)}
          className="min-w-0 flex-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <MarqueeTitle text={track.title} className="font-label text-label-sm text-foreground" pauseOnHover={false} />
          <MarqueeTitle text={track.artist} className="font-label text-label-sm text-muted" pauseOnHover={false} />
        </button>
        <PlayButton controls={controls} size={36} />
        <StepButton controls={controls} direction={1} />
      </div>
    </Portal>
  );
}
