"use client";

import { useEffect, useRef, useState } from "react";
import { BandPlayer } from "@/components/player/BandPlayer";
import { playerOwnsPill } from "@/lib/player/machine";
import { usePlayerView } from "@/lib/player/viewStore";
import { useSoundtrack } from "@/lib/soundtrack";
import { DOCK } from "@/lib/waveform/dock";
import { useFrozen } from "@/lib/waveform/freeze";
import { pillReached } from "@/lib/waveform/pillGate";
import { PlaybackPill } from "./PlaybackPill";
import { useBandPassed, usePromptOnScreen, usePromptPassed } from "./useBandPassed";
import { WaveCanvas } from "./WaveCanvas";

// The band's live half: the player, the waveform and the stock pill. One
// IntersectionObserver on the band (its top margin is the dock line,
// DOCK.passedPx) runs the band's wave while it shows; one ScrollTrigger
// (useBandPassed) decides from the scroll position when the reader has passed
// the band, and the stock pill fades in at its dock, unless the player is the
// pill (the music is playing or paused in it). Before an answer the pill is
// "Music?", a second ask, and waits for the prompt itself to scroll away
// unanswered (lib/waveform/pillGate.ts). Phones stack the wave under the copy
// and have no stock pill. The freeze toggle is not here: it lives in the
// prompt's line (and beside the answer after a decline, and in the player).
export function BandStage() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);
  const frozen = useFrozen();
  const music = useSoundtrack();
  const passed = useBandPassed();
  const promptPassed = usePromptPassed();
  const promptOnScreen = usePromptOnScreen();
  const view = usePlayerView();

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

  return (
    <>
      <BandPlayer />
      <div ref={stageRef} data-wave-band-line className="relative h-[var(--band-p,176px)] md:absolute md:inset-0 md:h-auto">
        <WaveCanvas active={inView} frozen={frozen} />
      </div>
      <PlaybackPill reached={pillReached({ music, bandPassed: passed, promptPassed, promptOnScreen }) && !playerOwnsPill(view)} />
    </>
  );
}
