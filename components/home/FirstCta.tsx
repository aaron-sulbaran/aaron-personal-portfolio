"use client";

import { Fill } from "@/components/fx/Fill";
import { useReducedMotionLive } from "@/components/soundtrack/useReducedMotionLive";
import { siteContent } from "@/lib/content";
import { CTA_LABEL_CLASS, CTA_LABEL_OVER_CLASS, FILL_PICK } from "@/lib/fx/fill";
import { isAfter, useDeal } from "@/lib/home/deal";
import { startClickDeal } from "@/lib/home/dealFlow";
import { EXPRESS_PATH } from "@/lib/quick/transition";
import { goTo } from "@/lib/quick/transitionStore";

// "Deal me in" and the small line under it, centered under the ribbon at the
// first screen's foot. The button is a real link to the cards (#work), so it
// leads there with no script at all; once the page has hydrated a click deals
// instead (startClickDeal: the deal, whose own clock scrolls the page to the
// cards). Once the cards are dealt and the text is back it reads "Back to my
// cards" (it scrolls there, no replay), and never earlier, so the label cannot
// flip under a line that is still fading. The small line leads to the
// 30-second version (no button, no pill: it blends into the page). Nothing here
// takes the scroll from the reader.
export function FirstCta() {
  const { teaser } = siteContent.intro;
  const reducedMotion = useReducedMotionLive();
  const after = isAfter(useDeal());
  return (
    <div data-first-cta="" data-deal-fade="" className="flex flex-col items-center gap-3 text-center">
      <Fill
        as="a"
        href="#work"
        {...FILL_PICK.cta}
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
          event.preventDefault();
          void startClickDeal(reducedMotion);
        }}
        className={CTA_LABEL_CLASS}
        overClassName={CTA_LABEL_OVER_CLASS}
        data-cursor-hover
      >
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
  );
}
