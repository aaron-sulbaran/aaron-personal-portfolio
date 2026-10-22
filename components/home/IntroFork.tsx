"use client";

import { useReducedMotionLive } from "@/components/soundtrack/useReducedMotionLive";
import { Fill } from "@/components/fx/Fill";
import { siteContent } from "@/lib/content";
import { CTA_LABEL_CLASS, CTA_LABEL_OVER_CLASS, FILL_PICK } from "@/lib/fx/fill";
import { useDealt } from "@/lib/home/deal";
import { scrollToCards } from "@/lib/home/dealScroll";
import { EXPRESS_PATH } from "@/lib/quick/transition";
import { goTo } from "@/lib/quick/transitionStore";

// The fork at the intro's foot: the deck (a placeholder until the deal is
// built), the one primary action that scrolls to the cards, the quiet line
// that says scrolling by hand does the same, and the quiet link to the
// 30-second version. Nothing here takes the scroll from the reader.
export function IntroFork() {
  const { fork } = siteContent.intro;
  const reducedMotion = useReducedMotionLive();
  const dealt = useDealt();
  return (
    <div data-intro-fork="" className="px-[6vw] pb-20 pt-6 md:pb-28">
      <div className="mx-auto flex max-w-[1240px] flex-col items-start gap-6 md:flex-row md:items-center md:gap-10">
        <div
          data-deck=""
          data-dealt={dealt ? "" : undefined}
          role="img"
          aria-label={fork.deckLabel}
          className="aspect-[3/4] w-20 shrink-0 rounded-xl border border-border bg-glass md:w-24"
        />
        <div className="flex flex-col items-start gap-3">
          <Fill {...FILL_PICK.cta} onClick={() => scrollToCards(reducedMotion)} className={CTA_LABEL_CLASS} overClassName={CTA_LABEL_OVER_CLASS} data-cursor-hover>
            {fork.deal}
          </Fill>
          <p className="font-label text-label-sm text-muted">{fork.scroll}</p>
          <a
            href={EXPRESS_PATH}
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
              event.preventDefault();
              goTo(EXPRESS_PATH);
            }}
            data-cursor-hover
            className="rounded-sm font-label text-label-sm text-muted underline decoration-1 underline-offset-[4px] transition-colors duration-200 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {fork.quick}
          </a>
        </div>
      </div>
    </div>
  );
}
