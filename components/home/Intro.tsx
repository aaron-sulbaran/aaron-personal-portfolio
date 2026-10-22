import { Fragment } from "react";
import { InlineCopy } from "@/components/inline/InlineCopy";
import { SoundtrackBand } from "@/components/soundtrack/SoundtrackBand";
import { siteContent } from "@/lib/content";
import { INTRO_HEADING_ID } from "@/lib/home/introId";
import { IntroFork } from "./IntroFork";

// The home's first screen (#about): the page's h1, a short version of the
// About copy composed at first paint (no staging), the soundtrack's choice
// and player at its foot (the band, #listen, full bleed so the wave runs the
// page's width), then the fork: the deck, "Deal me in" and the way to the
// 30-second version. A Server Component; the band and the fork are the
// client leaves. The copy shares the band's grid.
export function Intro() {
  const { ariaLabel, sentences } = siteContent.intro;
  return (
    <section id="about" aria-label={ariaLabel} className="relative w-full">
      <div className="px-[6vw] pt-28">
        <div className="mx-auto max-w-[1240px]">
          <h1 id={INTRO_HEADING_ID} tabIndex={-1} className="font-display text-display text-foreground focus-visible:outline-none">
            {siteContent.hero.heading}
          </h1>
          <p className="mt-8 max-w-[44rem] text-balance text-xl leading-[1.6] text-foreground md:mt-7 md:text-[22px] md:leading-[1.55]">
            {sentences.map((sentence, i) => (
              <Fragment key={sentence}>
                {i > 0 && " "}
                <InlineCopy source={sentence} />
              </Fragment>
            ))}
          </p>
        </div>
      </div>
      <SoundtrackBand />
      <IntroFork />
    </section>
  );
}
