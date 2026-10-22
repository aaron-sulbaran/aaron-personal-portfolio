"use client";

import { useReducedMotionLive } from "@/components/soundtrack/useReducedMotionLive";
import { Fill } from "@/components/fx/Fill";
import { siteContent } from "@/lib/content";
import { CTA_LABEL_CLASS, CTA_LABEL_OVER_CLASS, FILL_PICK } from "@/lib/fx/fill";
import { isAfter, useDeal } from "@/lib/home/deal";
import { startClickDeal } from "@/lib/home/dealFlow";
import { EXPRESS_PATH } from "@/lib/quick/transition";
import { goTo } from "@/lib/quick/transitionStore";

// The teaser at page 1's foot, one self-contained block: the question, "Deal me
// in" (startClickDeal: the deal, whose own clock scrolls the page to the
// cards), one small muted line under it to the 30-second version (no button,
// no pill: it blends into the page), and the wheel's slot (data-coil-wheel),
// which reserves the room the Coil's canvas turns the wheel in (the scene reads
// the slot's place and size) and holds a quiet outline where there is no scene
// to draw it. The text leaves when the deal starts (data-teaser-text) and comes
// back after it; once the cards are dealt and the text is back the button reads
// "Back to my cards" (it scrolls there, no replay), and never earlier, so the
// label cannot flip under a line that is still fading. It carries its own width and padding and
// assumes nothing of its parent. Nothing here takes the scroll from the reader.
export function Teaser() {
  const { teaser } = siteContent.intro;
  const reducedMotion = useReducedMotionLive();
  const after = isAfter(useDeal());
  return (
    <div data-teaser="" className="mx-auto w-full max-w-[1240px] px-[6vw] pb-6 pt-16 md:pb-12 md:pt-20">
      <div data-teaser-text="" className="flex flex-col items-start gap-5 md:gap-6">
        <p data-wave-words="" className="font-display text-[clamp(1.75rem,3.4vw,2.75rem)] leading-[1.08] text-foreground">
          {teaser.line}
        </p>
        <div className="flex flex-col items-start gap-3">
          <Fill {...FILL_PICK.cta} onClick={() => void startClickDeal(reducedMotion)} className={CTA_LABEL_CLASS} overClassName={CTA_LABEL_OVER_CLASS} data-cursor-hover>
            {after ? teaser.back : teaser.deal}
          </Fill>
          <a
            href={EXPRESS_PATH}
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
              event.preventDefault();
              goTo(EXPRESS_PATH);
            }}
            data-cursor-hover
            className="rounded-sm font-label text-label-sm text-muted decoration-1 underline-offset-[4px] transition-colors duration-200 hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {teaser.quick}
          </a>
        </div>
      </div>
      <div
        data-coil-wheel=""
        data-dealt={after ? "" : undefined}
        aria-hidden="true"
        className="mx-auto mt-10 aspect-square w-[min(68vw,20rem)] rounded-full border border-dashed border-border md:mt-12"
      />
    </div>
  );
}
