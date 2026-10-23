import { siteContent } from "@/lib/content";
import { BandInvite } from "./BandInvite";
import { BandStage } from "./BandStage";

// The soundtrack band (#listen): a full-bleed strip on page 1, between the
// blocks, where the music is introduced, with the waveform running the page's
// full width through it. The copy (the question and its answer) sits in a row
// of its own above the wave, on the page's grid, never over it: text never sits
// over moving dots, and a wave kept clear of a box above it by less than its
// own reach is damped there (lib/waveform/weights.ts), so a copy laid over the
// wave left it a flat row under the words. The wave's stage is the page's knob
// (--band-d from md up, --band-p on a phone, set by components/home/Intro.tsx),
// fixed in the server render, so nothing shifts when the client mounts. A
// Server Component; the copy and the stage are client leaves.
export function SoundtrackBand() {
  return (
    <section id="listen" data-wave-anchor="band" aria-label={siteContent.listen.ariaLabel} className="relative w-full">
      <div className="pointer-events-none relative z-10 px-[6vw]">
        <div className="mx-auto max-w-[1240px]">
          <BandInvite />
        </div>
      </div>
      <BandStage />
    </section>
  );
}
