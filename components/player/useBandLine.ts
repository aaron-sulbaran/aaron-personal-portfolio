"use client";

import { useState } from "react";
import { AHEAD_TOP } from "@/lib/player/zone";
import { ScrollTrigger, useGSAP } from "@/lib/gsap";

export interface BandLine {
  past: boolean; // the band's bottom edge has risen above the hand-off line
  ahead: boolean; // the band's top edge is still below the fold (the hero, the book)
}

// Where the reader is against the band, from two ScrollTriggers: the hand-off
// line, `line` of the viewport's height from its top, and the fold. Both read
// the scroll position on every crossing and refresh (the same pattern as the
// pill's dock line, useBandPassed), so a jump over the whole band still flips
// them both ways.
export function useBandLine(line: number, active: boolean): BandLine {
  const [past, setPast] = useState(false);
  const [ahead, setAhead] = useState(true);

  useGSAP(
    () => {
      if (!active) return;
      const readPast = (self: ScrollTrigger) => setPast(self.scroll() > self.start);
      const readAhead = (self: ScrollTrigger) => setAhead(self.scroll() <= self.start);
      const make = (start: string, read: (self: ScrollTrigger) => void) =>
        ScrollTrigger.create({ trigger: "#listen", start, onEnter: read, onLeave: read, onEnterBack: read, onLeaveBack: read, onRefresh: read });
      const pastTrigger = make(`bottom ${(line * 100).toFixed(1)}%`, readPast);
      const aheadTrigger = make(`top ${(AHEAD_TOP * 100).toFixed(1)}%`, readAhead);
      readPast(pastTrigger);
      readAhead(aheadTrigger);
      return () => {
        pastTrigger.kill();
        aheadTrigger.kill();
      };
    },
    { dependencies: [line, active], revertOnUpdate: true },
  );

  return { past, ahead };
}
