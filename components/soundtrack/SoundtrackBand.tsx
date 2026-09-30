import { siteContent } from "@/lib/content";
import { BandInvite } from "./BandInvite";
import { BandStage } from "./BandStage";

// The soundtrack band (#listen): a full-bleed strip directly under the book
// where the music is introduced, with the waveform running the page's full
// width through it. Its height is fixed in the server render (from md up), so
// nothing shifts when the client mounts. The copy sits in the upper part,
// aligned to the book's grid; the waveform keeps its moving dots out from
// under it. A Server Component; the copy and the stage are client leaves.
export function SoundtrackBand() {
  return (
    <section id="listen" aria-label={siteContent.listen.ariaLabel} className="relative w-full md:-mt-[5vh] md:h-[clamp(240px,30vh,340px)]">
      <div className="pointer-events-none relative z-10 px-[6vw] pt-6 md:absolute md:inset-x-0 md:top-0 md:pt-5">
        <div className="mx-auto max-w-[1240px]">
          <BandInvite />
        </div>
      </div>
      <BandStage />
    </section>
  );
}
