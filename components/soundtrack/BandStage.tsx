"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { siteContent } from "@/lib/content";
import { useSoundtrack } from "@/lib/soundtrack";
import { DOCK } from "@/lib/waveform/dock";
import { setFrozen, useFrozen } from "@/lib/waveform/freeze";
import { isPhone, subscribePhone } from "@/lib/waveform/layout";
import { HorizonCanvas } from "./HorizonCanvas";
import { PlaybackPill } from "./PlaybackPill";
import { useBandPassed } from "./useBandPassed";
import { WaveCanvas } from "./WaveCanvas";
import { acquireWaveConductor, type WaveConductor } from "./waveConductor";
import { useReducedMotionLive } from "./useReducedMotionLive";
import { useSweepTrigger } from "./useSweepTrigger";

// The band's live half: the waveform, the credit, the pill it hands the
// music to, and from md up the horizon strip the wave travels to as the
// reader scrolls on. One IntersectionObserver on the band decides whether the
// band's wave runs; one ScrollTrigger (useBandPassed) reads from the scroll
// position whether the band's bottom edge is above the dock line
// (DOCK.passedPx), which fades the pill in at its dock; another
// (useSweepTrigger) drives the sweep from the band to the horizon.
//
// Phones stack the wave under the copy in its own strip and have no horizon
// and no pill, so the freeze toggle always stays here for them; from md up the
// player card carries it while music is chosen, and the wave fills the whole
// band behind the copy.
export function BandStage() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const conductorRef = useRef<WaveConductor | null>(null);
  const [inView, setInView] = useState(false);
  const frozen = useFrozen();
  const music = useSoundtrack();
  const reduce = useReducedMotionLive();
  const phone = useSyncExternalStore(subscribePhone, isPhone, () => true);
  const c = siteContent.listen;
  const s = siteContent.soundtrack;

  // A layout effect so the conductor is held before the sweep trigger (a
  // layout effect too) is created; the canvases acquire the same instance.
  useLayoutEffect(() => {
    const conductor = acquireWaveConductor(reduce);
    conductorRef.current = conductor;
    return () => {
      conductor.release();
      conductorRef.current = null;
    };
  }, [reduce]);
  useSweepTrigger(conductorRef);
  const passed = useBandPassed();

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

  // Nothing moves under reduced motion, nor on a phone once the music is off
  // (the band's line is still and phones have no horizon), so the toggle has
  // nothing to do then. On desktop the horizon drifts even when declined. The
  // player card carries the toggle on desktop while music is on or paused;
  // before a choice and after a decline the capsule's click plays instead, so
  // the band keeps it there. Phones always keep it here.
  const freezable = !reduce && (music !== "off" || !phone);
  const inCard = music === "on" || music === "paused";

  return (
    <>
      <div ref={stageRef} className="relative h-[176px] md:absolute md:inset-0 md:h-auto">
        <WaveCanvas active={inView} frozen={frozen} />
      </div>
      <div className="relative z-10 px-[6vw] pb-5 md:absolute md:inset-x-0 md:bottom-0">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-baseline justify-between gap-x-8 gap-y-2 text-xs leading-[1.5] text-muted">
          <button
            type="button"
            data-wave-avoid
            inert={!freezable}
            onClick={() => setFrozen(!frozen)}
            data-cursor-hover
            className={`rounded-sm underline ${inCard ? "md:hidden" : ""} decoration-1 underline-offset-[3px] transition-[color,opacity] duration-200 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              freezable ? "opacity-100" : "opacity-0"
            }`}
          >
            {frozen ? c.unfreeze : c.freeze}
          </button>
          <p data-wave-avoid className="ml-auto">
            {s.creditLead}{" "}
            <a href={s.creditArtistUrl} target="_blank" rel="noopener noreferrer" className={LINK}>
              {s.creditArtist}
            </a>
            {s.creditJoin}{" "}
            <a href={s.creditLicenseUrl} target="_blank" rel="noopener noreferrer" className={LINK}>
              {s.creditLicense}
            </a>
          </p>
        </div>
      </div>
      <PlaybackPill reached={passed} />
      {phone ? null : <HorizonCanvas />}
    </>
  );
}

const LINK =
  "rounded-sm underline decoration-1 underline-offset-[3px] transition-colors duration-200 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
