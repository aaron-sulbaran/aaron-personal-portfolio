"use client";

import { useState, type CSSProperties, type PointerEvent } from "react";
import { Fill } from "@/components/fx/Fill";
import { useReducedMotionLive } from "@/components/soundtrack/useReducedMotionLive";
import { MvpUnfurl } from "@/components/quick/MvpUnfurl";
import { siteContent } from "@/lib/content";
import { quickCopy } from "@/lib/content/quick";
import { COIL } from "@/lib/coil/constants";
import { CTA_LABEL_CLASS, CTA_LABEL_OVER_CLASS, FILL_PICK } from "@/lib/fx/fill";
import { isAfter, useDeal } from "@/lib/home/deal";
import { setDealHover } from "@/lib/home/dealCue";
import { startClickDeal } from "@/lib/home/dealFlow";
import { ARRIVAL_STEP, arrivalStyle } from "@/lib/home/introArrival";
import { finishIntroArrival } from "@/lib/home/introArrivalEnd";
import { EXPRESS_PATH } from "@/lib/quick/transition";
import { goTo } from "@/lib/quick/transitionStore";

// "Deal me in" and the small line under it, centered under the ribbon at page
// 1's foot. The button is a real link to the cards (#work), so it
// leads there with no script at all; once the page has hydrated a click deals
// instead (startClickDeal: the deal, whose own clock scrolls the page to the
// cards). Once the cards are dealt and the text is back it reads "Back to my
// cards" (it scrolls there, no replay), and never earlier, so the label cannot
// flip under a line that is still fading. The small line leads to the
// MVP (no button, no pill: it blends into the page); under a fine pointer its
// "MVP" unfurls to "Minimum Viable Portfolio" over the page, past the line's box,
// so the line stays centred and nothing moves (components/quick/MvpUnfurl).
// Nothing here takes the scroll from the reader.
//
// The button moves with the cards above it. While a fine pointer is over it the
// ribbon eases faster and its gaps tighten toward the button (the cue the scene
// reads, lib/home/dealCue.ts; never under reduced motion). The click is
// unmistakable (slice 5): the button presses in to the press scale and springs
// back (a keyframe, app/globals.css), and the cards rush in toward it and pile up
// tight before they curl (the scene). Under reduced motion there is no press, and
// the deal jumps. It also arrives on load as the page's last item
// (lib/home/introArrival.ts).
export function IntroCta() {
  const { teaser } = siteContent.intro;
  // The line up to its last word, which is the MVP's short name and unfurls.
  const lead = teaser.quick.slice(0, teaser.quick.length - quickCopy.titleShort.length);
  const reducedMotion = useReducedMotionLive();
  const after = isAfter(useDeal());
  const [pressed, setPressed] = useState(false);
  // A mouse or pen over the button is the anticipation; touch has no hover to read.
  const cue = (on: boolean) => (event: PointerEvent) => {
    if (event.pointerType === "touch" || reducedMotion) return;
    setDealHover(on);
  };
  // The press; none under reduced motion or once the cards are dealt.
  const press = () => {
    if (reducedMotion || after) return;
    setPressed(true);
  };
  return (
    <div data-intro-cta="" data-deal-fade="" data-arrive="button" style={arrivalStyle(ARRIVAL_STEP.button)} className="flex flex-col items-center gap-3 text-center">
      <span
        data-deal-press=""
        data-pressed={pressed ? "" : undefined}
        onAnimationEnd={() => setPressed(false)}
        style={{ "--press-scale": COIL.deal.click.pressScale } as CSSProperties}
        className="inline-flex transition-transform duration-150 ease-out active:scale-[var(--press-scale)] motion-reduce:transition-none motion-reduce:active:scale-100"
      >
        <Fill
          as="a"
          href="#work"
          {...FILL_PICK.cta}
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
            event.preventDefault();
            setDealHover(false);
            finishIntroArrival();
            press();
            void startClickDeal(reducedMotion);
          }}
          onPointerEnter={cue(true)}
          onPointerLeave={cue(false)}
          className={CTA_LABEL_CLASS}
          overClassName={CTA_LABEL_OVER_CLASS}
          data-cursor-hover
          data-deal-button=""
        >
          {after ? teaser.back : teaser.deal}
        </Fill>
      </span>
      <a
        href={EXPRESS_PATH}
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
          event.preventDefault();
          goTo(EXPRESS_PATH);
        }}
        aria-label={teaser.quickName}
        data-cursor-hover
        data-mvp-link=""
        className="rounded-sm font-label text-label-sm text-muted transition-colors duration-200 hover:text-foreground focus-visible:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {lead}
        <MvpUnfurl overlay fill />
      </a>
    </div>
  );
}
