"use client";

import { useEffect, useRef, useState } from "react";
import { siteContent } from "@/lib/content";
import { useSoundtrack } from "@/lib/soundtrack";
import { DOCK } from "@/lib/waveform/dock";
import { setFrozen, useFrozen } from "@/lib/waveform/freeze";
import { PlaybackPill } from "./PlaybackPill";
import { useBandPassed } from "./useBandPassed";
import { WaveCanvas } from "./WaveCanvas";
import { useReducedMotionLive } from "./useReducedMotionLive";

// The band's live half: the waveform, the credit and the pill. One
// IntersectionObserver on the band (its top margin is the dock line,
// DOCK.passedPx) runs the band's wave while it shows; one ScrollTrigger
// (useBandPassed) decides from the scroll position when the reader has passed
// the band, and the pill fades in at its dock. Phones stack the wave under the
// copy and have no pill. The freeze toggle stays here until music is chosen
// (the player card carries it then on desktop); the band is still until the
// visitor answers, and its line breathes after either answer, so a decliner
// can always freeze it.
export function BandStage() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);
  const frozen = useFrozen();
  const music = useSoundtrack();
  const reduce = useReducedMotionLive();
  const c = siteContent.listen;
  const s = siteContent.soundtrack;
  const passed = useBandPassed();
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
  // The player card carries the toggle on desktop while music is on or paused;
  // before a choice and after a decline the capsule's click plays instead, so
  // the band keeps it there. Phones always keep it here. A toggle that just
  // let the wave go keeps the keyboard's focus, so it stays live until focus
  // leaves it.
  const freezable = !reduce;
  const live = freezable || focusHeld;
  const inCard = music === "on" || music === "paused";

  return (
    <>
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
            className={`rounded-sm underline ${inCard ? "md:hidden" : ""} decoration-1 underline-offset-[3px] text-accent transition-[color,opacity] duration-200 hover:text-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              live ? "opacity-100" : "opacity-0"
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
    </>
  );
}

const LINK =
  "rounded-sm text-accent underline decoration-1 underline-offset-[3px] transition-colors duration-200 hover:text-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
