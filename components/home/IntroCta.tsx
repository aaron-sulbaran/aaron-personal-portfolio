"use client";

import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { Fill } from "@/components/fx/Fill";
import { useReducedMotionLive } from "@/components/soundtrack/useReducedMotionLive";
import { siteContent } from "@/lib/content";
import { COIL } from "@/lib/coil/constants";
import { CTA_LABEL_CLASS, CTA_LABEL_OVER_CLASS, FILL_PICK } from "@/lib/fx/fill";
import { isAfter, useDeal } from "@/lib/home/deal";
import { setDealHover } from "@/lib/home/dealCue";
import { startClickDeal } from "@/lib/home/dealFlow";
import { getKnobs } from "@/lib/home/dealKnobs";
import { pulseGeometry } from "@/lib/home/dealPulse";
import { ARRIVAL_STEP, arrivalStyle } from "@/lib/home/introArrival";
import { finishIntroArrival } from "@/lib/home/introArrivalEnd";
import { EXPRESS_PATH } from "@/lib/quick/transition";
import { goTo } from "@/lib/quick/transitionStore";
import { DealPulse, type Pulse } from "./DealPulse";

// "Deal me in" and the small line under it, centered under the ribbon at page
// 1's foot. The button is a real link to the cards (#work), so it
// leads there with no script at all; once the page has hydrated a click deals
// instead (startClickDeal: the deal, whose own clock scrolls the page to the
// cards). Once the cards are dealt and the text is back it reads "Back to my
// cards" (it scrolls there, no replay), and never earlier, so the label cannot
// flip under a line that is still fading. The small line leads to the
// 30-second version (no button, no pill: it blends into the page). Nothing here
// takes the scroll from the reader.
//
// The button moves with the cards above it. While a fine pointer is over it the
// ribbon eases faster and its gaps tighten toward the button (the cue the scene
// reads, lib/home/dealCue.ts; never under reduced motion). The click is
// unmistakable (slice 5): the button presses in to the press scale and springs
// back (a keyframe, app/globals.css), a soft accent ring spreads from it across
// the strip (components/home/DealPulse.tsx, in the layer that covers it), and the
// cards rush in toward it and pile up before they curl (the scene). Under reduced
// motion there is no ring and no press, and the deal jumps. It also arrives on
// load as the page's last item (lib/home/introArrival.ts).
export function IntroCta() {
  const { teaser } = siteContent.intro;
  const reducedMotion = useReducedMotionLive();
  const after = isAfter(useDeal());
  const layerRef = useRef<HTMLSpanElement>(null);
  const pressRef = useRef<HTMLSpanElement>(null);
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const [pressed, setPressed] = useState(false);
  const pulses = useRef(0);
  // A mouse or pen over the button is the anticipation; touch has no hover to read.
  const cue = (on: boolean) => (event: PointerEvent) => {
    if (event.pointerType === "touch" || reducedMotion) return;
    setDealHover(on);
  };
  // The press and the ring, from the button's place now; none under reduced motion or once the cards are dealt.
  const flare = () => {
    const layer = layerRef.current;
    const button = pressRef.current;
    if (reducedMotion || after || !layer || !button) return;
    const { clickRingMs, clickRingStrength } = getKnobs();
    pulses.current += 1;
    setPressed(true);
    if (clickRingStrength > 0) {
      setPulse({ ...pulseGeometry(button.getBoundingClientRect(), layer.getBoundingClientRect()), key: pulses.current, ms: clickRingMs, strength: clickRingStrength });
    }
  };
  return (
    <>
      <DealPulse pulse={pulse} layerRef={layerRef} onDone={() => setPulse(null)} />
      <div data-intro-cta="" data-deal-fade="" data-arrive="button" style={arrivalStyle(ARRIVAL_STEP.button)} className="flex flex-col items-center gap-3 text-center">
        <span
          ref={pressRef}
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
              flare();
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
          data-cursor-hover
          className="rounded-sm font-label text-label-sm text-muted decoration-1 underline-offset-[4px] transition-colors duration-200 hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {teaser.quick}
        </a>
      </div>
    </>
  );
}
