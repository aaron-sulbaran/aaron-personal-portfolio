"use client";

import { useState } from "react";
import { ScrollTrigger, useGSAP } from "@/lib/gsap";
import { AHEAD_TOP, ISLE_LINE } from "@/lib/player/constants";
import { zoneFrom, type Zone } from "@/lib/player/zone";

// Where the reader is against the band, from two ScrollTriggers: the hand-off
// line, ISLE_LINE of the viewport's height from its top, and the fold. Both
// read the scroll position on every crossing and refresh (the same pattern as
// the pill's dock line, useBandPassed), so a jump over the whole band still
// flips them both ways. A page with no band (anything but the home page) is
// all ahead: the isle is what shows there.
export function useBandZone(pathname: string): Zone {
  const [past, setPast] = useState(false);
  const [ahead, setAhead] = useState(true);

  useGSAP(
    () => {
      if (!document.getElementById("listen")) {
        setPast(false);
        setAhead(true);
        return;
      }
      const readPast = (self: ScrollTrigger) => setPast(self.scroll() > self.start);
      const readAhead = (self: ScrollTrigger) => setAhead(self.scroll() <= self.start);
      const make = (start: string, read: (self: ScrollTrigger) => void) =>
        ScrollTrigger.create({ trigger: "#listen", start, onEnter: read, onLeave: read, onEnterBack: read, onLeaveBack: read, onRefresh: read });
      const pastTrigger = make(`bottom ${(ISLE_LINE * 100).toFixed(1)}%`, readPast);
      const aheadTrigger = make(`top ${(AHEAD_TOP * 100).toFixed(1)}%`, readAhead);
      readPast(pastTrigger);
      readAhead(aheadTrigger);
      return () => {
        pastTrigger.kill();
        aheadTrigger.kill();
      };
    },
    { dependencies: [pathname], revertOnUpdate: true },
  );

  return zoneFrom(past, ahead);
}
