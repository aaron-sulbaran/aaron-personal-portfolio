import type { CSSProperties } from "react";
import { SoundtrackBand } from "@/components/soundtrack/SoundtrackBand";
import { siteContent } from "@/lib/content";
import { introDomPlan } from "@/lib/home/introDom";
import { INTRO_HEADING_ID } from "@/lib/home/introId";
import { DEFAULT_INTRO_KNOBS } from "@/lib/home/introKnobs";
import { FIRST_SCREEN_BLOCKS } from "@/lib/home/storyLayout";
import { FirstCta } from "./FirstCta";
import { RibbonSlotRelease } from "./RibbonSlotRelease";
import { RibbonStill } from "./RibbonStill";
import { StoryBlock } from "./StoryBlock";

// The home's first screen, everything a visitor needs with no scroll: the logo
// and Menu (the chrome), the name, blocks 1 and 2 of the story, the soundtrack
// band's thin wave, the ribbon of the fourteen cards and "Deal me in". One
// 100svh screen (a phone's holds block 1 and, by a lab knob, block 2).
//
// The name is drawn by the Coil scene (the field inside its letters), which
// reads where this h1's lockup sits ([data-coil-name]) and draws the same
// lockup on it; the ribbon is drawn by the scene too, in the slot left for it
// ([data-coil-ribbon]); the blocks and the band are the text the field fades
// away behind ([data-hush]). Where no scene draws (JavaScript off, reduced
// motion, no WebGL 2, and the page's after state once the cards are dealt) the
// same h1 shows as text with the field as its fill, and the ribbon as a still
// row (app/globals.css). The sr-only text is the heading either way. A Server
// Component; the band and the button are the client leaves.
export function FirstScreen() {
  const { ariaLabel, blocks } = siteContent.intro;
  const { hero } = siteContent;
  const plan = introDomPlan(DEFAULT_INTRO_KNOBS);
  return (
    <section data-first-screen="" aria-label={ariaLabel} {...plan.firstScreen.attrs} style={plan.firstScreen.vars as CSSProperties} className="first-screen relative z-[1] w-full">
      <div data-first-field="" aria-hidden="true" className="first-field" />
      <div data-first-top="" className="first-top">
        <h1 id={INTRO_HEADING_ID} tabIndex={-1} data-coil-name="" className="name-lockup first-name focus-visible:outline-none">
          <span className="sr-only">{hero.heading}</span>
          <span aria-hidden="true" data-name-visual="" className="name-lockup__greet">
            {hero.greeting}
          </span>
          <span aria-hidden="true" data-name-visual="" data-lockup-name="" className="name-lockup__name">
            {hero.name}
          </span>
        </h1>
        <div data-first-blocks="" data-hush="" data-deal-fade="" className="first-blocks">
          {FIRST_SCREEN_BLOCKS.map((index, position) => (
            <StoryBlock
              key={blocks[index].key}
              blockKey={blocks[index].key}
              domId={`story-${blocks[index].key}`}
              sentences={blocks[index].sentences}
              dom={plan.firstBlocks[position]}
            />
          ))}
        </div>
      </div>
      <div data-first-band="" data-hush="" data-deal-fade="" className="first-band">
        <SoundtrackBand />
      </div>
      <div data-first-ribbon="" className="first-ribbon">
        <div data-coil-ribbon="" className="first-ribbon__slot">
          <RibbonStill />
        </div>
      </div>
      <FirstCta />
      <RibbonSlotRelease />
    </section>
  );
}
