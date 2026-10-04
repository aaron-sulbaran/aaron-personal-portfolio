"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { siteContent } from "@/lib/content";
import { useSoundtrack } from "@/lib/soundtrack";
import { DOCK } from "@/lib/waveform/dock";
import { setFrozen, useFrozen } from "@/lib/waveform/freeze";
import { isPhone, subscribePhone } from "@/lib/waveform/layout";
import { HorizonCanvas } from "./HorizonCanvas";
import { PlaybackPill } from "./PlaybackPill";
import { WaveCanvas } from "./WaveCanvas";
import { acquireWaveConductor, type WaveConductor } from "./waveConductor";
import { useReducedMotionLive } from "./useReducedMotionLive";
import { useSweepTrigger } from "./useSweepTrigger";

// The band's live half: the waveform, the credit, the pill it hands the
// music to, and from md up the horizon strip the wave travels to as the
// reader scrolls on. One IntersectionObserver on the band decides whether the
// band's wave runs; one ScrollTrigger (useSweepTrigger) drives the sweep from
// the band to the horizon, and the pill docks once its target passes
// DOCK.arriveAtSweep.
//
// Phones stack the wave under the copy in its own strip and have no horizon
// and no pill, so the freeze toggle always stays here for them; from md up the
// player card carries it while music is chosen, and the wave fills the whole
// band behind the copy.
export function BandStage() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const conductorRef = useRef<WaveConductor | null>(null);
  const [inView, setInView] = useState<boolean | null>(null);
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
  const reached = useDockReached(conductorRef, reduce);

  useEffect(() => {
    const band = stageRef.current?.closest("section");
    if (!band) return;
    // The top margin is the header bar's height: a band tucked under the bar
    // is already out of view.
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      rootMargin: "-72px 0px 0px 0px",
    });
    observer.observe(band);
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
        <WaveCanvas active={inView === true} frozen={frozen} />
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
      <PlaybackPill reached={reached} />
      {phone ? null : <HorizonCanvas />}
    </>
  );
}

// The dock's trigger, read from the sweep target the band's ScrollTrigger
// writes (the conductor notifies on every new target, stepping or not). The
// conductor is replaced when reduced motion toggles, so the subscription
// follows `reduce`; the ref is filled in a layout effect before this reads it.
function useDockReached(conductorRef: RefObject<WaveConductor | null>, reduce: boolean): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => conductorRef.current?.subscribe(onChange) ?? (() => {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a new conductor per `reduce`
    [conductorRef, reduce],
  );
  const read = () => (conductorRef.current?.sweep.target ?? 0) > DOCK.arriveAtSweep;
  return useSyncExternalStore(subscribe, read, () => false);
}

const LINK =
  "rounded-sm underline decoration-1 underline-offset-[3px] transition-colors duration-200 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
