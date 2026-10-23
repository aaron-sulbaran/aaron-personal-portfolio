import type { CSSProperties } from "react";
import { siteContent } from "@/lib/content";
import { introDomPlan } from "@/lib/home/introDom";
import { DEFAULT_INTRO_KNOBS } from "@/lib/home/introKnobs";
import { ABOUT_BLOCKS, PHONE_MOVABLE_BLOCK } from "@/lib/home/storyLayout";
import { StoryBlock } from "./StoryBlock";

// "More about me" (#about), after the cards and before the proof of work: blocks
// 3 ("outside") and 4 ("from"), whole, with their pops and defs, staggered to
// alternating sides. A phone's first screen leaves block 2 to this section by
// default (a lab knob puts it on the first screen instead), so its copy is
// here too, first, and CSS shows exactly one of the two (app/globals.css). A
// Server Component.
export function AboutSection() {
  const { blocks, more } = siteContent.intro;
  const plan = introDomPlan(DEFAULT_INTRO_KNOBS);
  const phoneCopy = blocks[PHONE_MOVABLE_BLOCK];
  return (
    <section id="about" data-about="" aria-label={more} {...plan.about.attrs} style={plan.about.vars as CSSProperties} className="relative w-full px-[6vw] py-16 md:py-24">
      <div className="mx-auto max-w-[1240px]">
        <h2 className="mb-8 font-label text-label text-muted md:mb-10">{more}</h2>
        <div data-about-blocks="" className="about-blocks">
          <StoryBlock key="phone-copy" blockKey={phoneCopy.key} domId={`about-${phoneCopy.key}`} sentences={phoneCopy.sentences} dom={{ attrs: {}, vars: {} }} />
          {ABOUT_BLOCKS.map((index, position) => (
            <StoryBlock key={blocks[index].key} blockKey={blocks[index].key} domId={`story-${blocks[index].key}`} sentences={blocks[index].sentences} dom={plan.aboutBlocks[position]} />
          ))}
        </div>
      </div>
    </section>
  );
}
