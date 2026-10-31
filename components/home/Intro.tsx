import type { CSSProperties } from "react";
import { SoundtrackBand } from "@/components/soundtrack/SoundtrackBand";
import { SectionNumber } from "@/components/sections/SectionNumber";
import { PAGE_NUMBERS, siteContent } from "@/lib/content";
import { ARRIVAL_STEP, arrivalStyle } from "@/lib/home/introArrival";
import { introDomPlan } from "@/lib/home/introDom";
import { INTRO_HEADING_ID } from "@/lib/home/introId";
import { DEFAULT_INTRO_KNOBS } from "@/lib/home/introKnobs";
import { LATE_BLOCKS, TOP_BLOCKS, sideOf } from "@/lib/home/storyLayout";
import { IntroArrival } from "./IntroArrival";
import { IntroCta } from "./IntroCta";
import { NameCanvas } from "./NameCanvas";
import { RibbonSlotRelease } from "./RibbonSlotRelease";
import { RibbonStill } from "./RibbonStill";
import { StoryBlock } from "./StoryBlock";

// Page 1 (#about), "who I am": two paragraphs about me, whole, then the cards.
// Top to bottom: the name ("Hi, I'm Aaron", the field inside its letters, drawn
// in its own small canvas) with paragraph 1 to its right, in one row; the
// soundtrack band's wave across the page; paragraph 2 on the left, the late
// grid's right-hand columns left free as the open player's room (the band's card
// stands there, so it never covers words); then, at the page's foot, the ribbon
// of the fourteen cards (drawn by the Coil scene in its slot) and "Deal me in",
// the ribbon a beat of its own with room above it and the button its distance
// below. A phone stacks the same order. Nothing here moves when the deal plays:
// the page scrolls on to the cards, and a way back up finds this page as it was.
//
// The h1 is the heading in every case: its sr-only text is what is read, and
// its visual spans are the lockup the name canvas draws on (and, where no
// canvas draws, the CSS fallback: text with the field as its fill). Where each
// block sits is data (lib/home/storyLayout.ts); the sizes are the lab's knobs at
// their defaults (lib/home/introDom.ts, moved in dev by IntroLabBridge). A Server
// Component; the canvas, the band and the button are the client leaves.
export function Intro() {
  const { ariaLabel, blocks } = siteContent.intro;
  const { hero } = siteContent;
  const plan = introDomPlan(DEFAULT_INTRO_KNOBS);
  const block = (index: number) => (
    <StoryBlock key={blocks[index].key} blockKey={blocks[index].key} domId={`story-${blocks[index].key}`} sentences={blocks[index].sentences} side={sideOf(index)} arrivalStep={ARRIVAL_STEP.blocks[index]} />
  );
  return (
    <section id="about" data-intro="" aria-label={ariaLabel} style={plan.page.vars as CSSProperties} className="intro relative w-full">
      <div data-intro-top="" className="intro-grid intro-grid--top">
        <div data-name-stage="" data-arrive="name" style={arrivalStyle(ARRIVAL_STEP.name)} className="intro-name">
          <SectionNumber value={PAGE_NUMBERS.home} className="absolute -top-7 left-0" />
          <h1 id={INTRO_HEADING_ID} tabIndex={-1} data-coil-name="" className="name-lockup intro-heading focus-visible:outline-none">
            <span className="sr-only">{hero.heading}</span>
            <span aria-hidden="true" data-name-visual="" className="name-lockup__greet">
              {hero.greeting}
            </span>
            <span aria-hidden="true" data-name-visual="" data-lockup-name="" className="name-lockup__name">
              {hero.name}
            </span>
          </h1>
          <NameCanvas />
        </div>
        {TOP_BLOCKS.map(block)}
      </div>
      <div data-intro-band="" className="intro-band">
        <SoundtrackBand />
      </div>
      <div data-intro-late="" className="intro-grid intro-grid--late">
        {LATE_BLOCKS.map(block)}
      </div>
      <div data-intro-foot="" className="intro-foot">
        <div data-first-ribbon="" className="intro-foot__ribbon">
          <div data-coil-ribbon="" className="intro-foot__slot">
            <RibbonStill />
          </div>
        </div>
        <div data-cta-track="" className="intro-foot__cta-track">
          <div data-cta-pin="" className="intro-foot__cta-pin">
            <IntroCta />
          </div>
          <div aria-hidden="true" className="intro-foot__cta-room" />
        </div>
      </div>
      <RibbonSlotRelease />
      <IntroArrival />
    </section>
  );
}
