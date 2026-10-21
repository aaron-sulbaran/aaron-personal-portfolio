"use client";

import { useEffect, useRef, useState } from "react";
import { BandPlayer } from "@/components/player/BandPlayer";
import { siteContent } from "@/lib/content";
import { playerOwnsPill } from "@/lib/player/machine";
import { usePlayerView } from "@/lib/player/viewStore";
import { useSoundtrack } from "@/lib/soundtrack";
import { DOCK } from "@/lib/waveform/dock";
import { setFrozen, useFrozen } from "@/lib/waveform/freeze";
import { PlaybackPill } from "./PlaybackPill";
import { useBandPassed } from "./useBandPassed";
import { WaveCanvas } from "./WaveCanvas";
import { useReducedMotionLive } from "./useReducedMotionLive";

// The band's live half: the player, the waveform and the stock pill. One
// IntersectionObserver on the band (its top margin is the dock line,
// DOCK.passedPx) runs the band's wave while it shows; one ScrollTrigger
// (useBandPassed) decides from the scroll position when the reader has passed
// the band, and the stock pill fades in at its dock, unless the player is the
// pill (the music is playing or paused in it). Phones stack the wave under the
// copy and have no stock pill. The "Freeze the wave" link stays here in every
// state but a decline, where "Not now" brings it beside the question's answer;
// it is the one freeze there is while the music plays.
export function BandStage() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);
  const frozen = useFrozen();
  const music = useSoundtrack();
  const reduce = useReducedMotionLive();
  const c = siteContent.listen;
  const passed = useBandPassed();
  const view = usePlayerView();
  const [focusHeld, setFocusHeld] = useState(false);

  useEffect(() => {
    const section = stageRef.current?.closest("section");
    if (!section) return;
    // The top margin is the dock line: the header bar plus an anchor's
    // landing, where a band tucked under them is already out of view.
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      rootMargin: `-${DOCK.passedPx}px 0px 0px 0px`,
    });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  // Nothing moves under reduced motion, so the toggle has nothing to do then.
  // After "Not now" the freeze is a button beside the "No problem" line
  // (DeclinedNote), so this link goes. A toggle that just let the wave go keeps
  // the keyboard's focus, so it stays live until focus leaves it.
  const freezable = !reduce;
  const live = (freezable || focusHeld) && music !== "off";

  return (
    <>
      <BandPlayer />
      <div ref={stageRef} data-wave-band-line className="relative h-[176px] md:absolute md:inset-0 md:h-auto">
        <WaveCanvas active={inView} frozen={frozen} />
      </div>
      <div className="relative z-10 px-[6vw] pb-5 md:absolute md:inset-x-0 md:bottom-0">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-baseline justify-between gap-x-8 gap-y-2 font-label text-label-sm leading-[1.5] text-muted">
          <button
            type="button"
            data-wave-avoid
            inert={!live}
            onClick={() => setFrozen(!frozen)}
            onFocus={() => setFocusHeld(true)}
            onBlur={() => setFocusHeld(false)}
            data-cursor-hover
            className={`rounded-sm underline decoration-1 underline-offset-[3px] text-accent transition-[color,opacity] duration-200 hover:text-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              live ? "opacity-100" : "opacity-0"
            }`}
          >
            {frozen ? c.unfreeze : c.freeze}
          </button>
        </div>
      </div>
      <PlaybackPill reached={passed && !playerOwnsPill(view)} />
    </>
  );
}
