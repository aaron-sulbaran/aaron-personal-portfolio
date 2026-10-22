import type { CSSProperties } from "react";
import { SoundtrackBand } from "@/components/soundtrack/SoundtrackBand";
import { siteContent } from "@/lib/content";
import { introDomPlan } from "@/lib/home/introDom";
import { INTRO_HEADING_ID } from "@/lib/home/introId";
import { DEFAULT_INTRO_KNOBS } from "@/lib/home/introKnobs";
import { BAND_ID, sequenceOf, storyItems } from "@/lib/home/storyLayout";
import { MoreAboutMe } from "./MoreAboutMe";
import { StoryBlock } from "./StoryBlock";
import { Teaser } from "./Teaser";
import { NameField } from "./nameField/NameField";

// The home's first page (#about), "who I am": the stage (the heading, "Hi, I'm"
// over "Aaron", on the shader field), four short paragraph blocks staggered
// across the column with the soundtrack band (#listen) between the second and
// third, and the teaser at the foot. The heading is server-rendered at its
// final place, hidden under the loader only while it runs
// (components/home/loader), so the loader's name shrinks onto it with no layout
// shift. Where things sit is the lab's knobs, here at their defaults and moved
// in dev by components/home/IntroLabBridge.tsx (lib/home/introDom.ts is the one
// plan both use). The blocks are composed at first paint, no staging. A Server
// Component; the field, the band, the teaser and the disclosure are the client
// leaves.
export function Intro() {
  const { ariaLabel, blocks, more } = siteContent.intro;
  const { hero } = siteContent;
  const plan = introDomPlan(DEFAULT_INTRO_KNOBS, blocks.length);
  const story = storyItems(blocks.length, DEFAULT_INTRO_KNOBS);
  const sequence = sequenceOf(story, "desktop");
  const collapsible = story.filter((item) => item.collapsible).map((item) => `story-${item.id}`);
  return (
    <section id="about" data-intro="" aria-label={ariaLabel} {...plan.section.attrs} style={plan.section.vars as CSSProperties} className="relative w-full">
      <div data-intro-stage="">
        <NameField />
        <div data-intro-heading-wrap="">
          <h1 id={INTRO_HEADING_ID} tabIndex={-1} data-intro-heading="" className="name-lockup text-foreground focus-visible:outline-none">
            <span className="sr-only">{hero.heading}</span>
            <span aria-hidden="true" className="name-lockup__greet">
              {hero.greeting}
            </span>
            <span aria-hidden="true" data-lockup-name="" className="name-lockup__name">
              {hero.name}
            </span>
          </h1>
        </div>
      </div>
      <div data-story="">
        {sequence.map((id) =>
          id === BAND_ID ? (
            <div key={id} data-story-item={id} {...plan.items[id].attrs} style={plan.items[id].vars as CSSProperties} className="w-full">
              <SoundtrackBand />
            </div>
          ) : (
            <StoryBlock key={id} id={id} domId={`story-${id}`} sentences={blocks[Number(id.replace("block-", "")) - 1].sentences} dom={plan.items[id]} />
          ),
        )}
        <MoreAboutMe label={more} controls={collapsible.join(" ")} dom={plan.items.more} />
      </div>
      <Teaser />
    </section>
  );
}

