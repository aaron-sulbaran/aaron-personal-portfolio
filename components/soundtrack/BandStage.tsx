"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { siteContent } from "@/lib/content";
import { useSoundtrack } from "@/lib/soundtrack";
import { PlaybackPill } from "./PlaybackPill";
import { WaveCanvas } from "./WaveCanvas";

// The band's live half: the waveform, the freeze toggle, the credit, and the
// pill it hands the music to. One IntersectionObserver on the band decides
// both whether the wave runs and whether the pill shows (only while the band
// is off screen). No ScrollTrigger on this surface.
//
// Phones stack the wave under the copy in its own strip; from md up the wave
// fills the whole band behind the copy, on the band's midline.
export function BandStage() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState<boolean | null>(null);
  const [frozen, setFrozen] = useState(false);
  const music = useSoundtrack();
  const reduce = useReducedMotion() ?? false;
  const c = siteContent.listen;
  const s = siteContent.soundtrack;

  useEffect(() => {
    const band = stageRef.current?.closest("section");
    if (!band) return;
    // The top margin is the header bar's height: a band tucked under the bar
    // is already out of reach, so the pill takes over there.
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      rootMargin: "-72px 0px 0px 0px",
    });
    observer.observe(band);
    return () => observer.disconnect();
  }, []);

  // Nothing moves when the music is off or motion is reduced, so the freeze
  // toggle has nothing to do then.
  const freezable = music !== "off" && !reduce;

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
            onClick={() => setFrozen((value) => !value)}
            data-cursor-hover
            className={`rounded-sm underline decoration-1 underline-offset-[3px] transition-[color,opacity] duration-200 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              freezable ? "opacity-100" : "opacity-0"
            }`}
          >
            {frozen ? c.unfreeze : c.freeze}
          </button>
          <p data-wave-avoid>
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
      <PlaybackPill bandInView={inView} />
    </>
  );
}

const LINK =
  "rounded-sm underline decoration-1 underline-offset-[3px] transition-colors duration-200 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
